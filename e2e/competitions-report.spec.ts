import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

interface Match {
  id: string;
  competition_id: string;
  winner_id: string;
  loser_id: string;
  winner_score: number | null;
  loser_score: number | null;
  created_at: string;
}

/** What the fake database holds, which the test changes. */
interface World {
  competitions: Array<{ id: string; position: number; name: string }>;
  guests: string[];
  matches: Match[];
  /** Each report_match call takes the next answer; "reported" stores it. */
  answers: string[];
  /** The bodies of the report_match calls. */
  reports: Array<Record<string, unknown>>;
  /** The error codes sent to log_client_error. */
  logged: string[];
}

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const guestId = (name: string) => `g-${name.toLowerCase()}`;

/** Fakes an event with Competitions on, as a guest "Anna" sees it. */
async function fakeCompetitions(page: Page, world: World) {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, 200, [
      {
        ...eventRow({
          code,
          enabled_modules: ["competitions"],
          status: "live",
        }),
        members: [
          memberRow({ user_id: "u1", display_name: "Anna" }),
          ...world.guests.map((name) =>
            memberRow({ user_id: guestId(name), display_name: name }),
          ),
          memberRow({ user_id: "t1", role: "tv" }),
        ],
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/competitions*`, (route) =>
    json(route, 200, world.competitions),
  );
  await page.route(`${supabase}/rest/v1/competition_matches*`, (route) =>
    json(route, 200, world.matches),
  );
  await page.route(`${supabase}/rest/v1/rpc/log_client_error`, (route) => {
    const body = route.request().postDataJSON() as { error_code: string };
    world.logged.push(body.error_code);
    return json(route, 200, "logged");
  });
  await page.route(`${supabase}/rest/v1/rpc/report_match`, (route) => {
    const body = route.request().postDataJSON() as {
      target_competition_id: string;
      winner: string;
      loser: string;
      winner_score: number | null;
      loser_score: number | null;
    };
    world.reports.push(body);
    const answer = world.answers.shift() ?? "unknown";
    if (answer === "reported") {
      world.matches.unshift({
        id: `m${world.matches.length + 1}`,
        competition_id: body.target_competition_id,
        winner_id: body.winner,
        loser_id: body.loser,
        winner_score: body.winner_score ?? null,
        loser_score: body.loser_score ?? null,
        created_at: "2026-11-09T20:00:00Z",
      });
    }
    return json(route, 200, answer);
  });
}

function world(overrides: Partial<World> = {}): World {
  return {
    competitions: [
      { id: "c1", position: 0, name: "Ping pong" },
      { id: "c2", position: 1, name: "Darts" },
    ],
    guests: ["Bertil", "Cecilia"],
    matches: [],
    answers: ["reported"],
    reports: [],
    logged: [],
    ...overrides,
  };
}

test.use({ viewport: { width: 390, height: 844 } });

test("a guest reports a match they won, with a score", async ({ page }) => {
  const w = world();
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  const form = page.getByTestId("match-form");
  await expect(
    page.getByRole("heading", { name: "Report a match" }),
  ).toBeVisible();
  await expect(page.getByTestId("my-matches")).toContainText(
    "No matches reported yet.",
  );
  const submit = form.getByRole("button", { name: "Report match" });
  await expect(submit).toBeDisabled();

  await form.getByRole("button", { name: "Ping pong" }).click();
  await form.getByRole("button", { name: "Bertil" }).click();
  await form.getByRole("button", { name: "I won" }).click();
  await form.getByLabel("Your score").fill("11");
  await form.getByLabel("Their score").fill("7");
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByTestId("match-reported")).toContainText(
    "Match reported!",
  );
  expect(w.reports).toEqual([
    {
      target_event_id: "00000000-0000-0000-0000-0000000000e1",
      target_competition_id: "c1",
      winner: "u1",
      loser: guestId("Bertil"),
      winner_score: 11,
      loser_score: 7,
    },
  ]);
  await expect(page.getByTestId("my-matches")).toContainText(
    "Ping pong: you beat Bertil",
  );
  await expect(page.getByTestId("my-matches")).toContainText("11–7");

  await page.getByRole("button", { name: "Report another match" }).click();
  await expect(page.getByTestId("match-form")).toBeVisible();
});

test("a guest who lost reports the opponent as the winner, without a score", async ({
  page,
}) => {
  const w = world();
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  const form = page.getByTestId("match-form");
  await form.getByRole("button", { name: "Darts" }).click();
  await form.getByRole("button", { name: "Cecilia" }).click();
  await form.getByRole("button", { name: "I lost" }).click();
  await form.getByRole("button", { name: "Report match" }).click();

  await expect(page.getByTestId("match-reported")).toBeVisible();
  expect(w.reports[0]).toMatchObject({
    target_competition_id: "c2",
    winner: guestId("Cecilia"),
    loser: "u1",
  });
  expect(w.reports[0]?.winner_score ?? null).toBeNull();
  await expect(page.getByTestId("my-matches")).toContainText(
    "Darts: Cecilia beat you",
  );
});

test("a failed report keeps what was entered and logs only a code", async ({
  page,
}) => {
  const w = world({ answers: ["rate_limited", "reported"] });
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  const form = page.getByTestId("match-form");
  await form.getByRole("button", { name: "Ping pong" }).click();
  await form.getByRole("button", { name: "Bertil" }).click();
  await form.getByRole("button", { name: "I won" }).click();
  await form.getByLabel("Your score").fill("21");
  await form.getByLabel("Their score").fill("15");
  await form.getByRole("button", { name: "Report match" }).click();

  await expect(form.getByRole("alert")).toContainText(
    "You've reported a lot of matches",
  );
  await expect(form.getByRole("button", { name: "Bertil" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(form.getByRole("button", { name: "I won" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(form.getByLabel("Your score")).toHaveValue("21");
  await expect(form.getByLabel("Their score")).toHaveValue("15");
  await expect.poll(() => w.logged).toEqual(["rate_limited"]);

  await form.getByRole("button", { name: "Report match" }).click();
  await expect(page.getByTestId("match-reported")).toBeVisible();
});

test("a network failure shows the try-again message", async ({ page }) => {
  const w = world({ answers: ["unknown"] });
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  const form = page.getByTestId("match-form");
  await form.getByRole("button", { name: "Ping pong" }).click();
  await form.getByRole("button", { name: "Bertil" }).click();
  await form.getByRole("button", { name: "I won" }).click();
  await form.getByRole("button", { name: "Report match" }).click();

  await expect(form.getByRole("alert")).toHaveText(
    "Your match didn't go through. Try again.",
  );
  await expect.poll(() => w.logged).toEqual(["unknown"]);
});

test("a score where the winner doesn't lead is stopped before sending", async ({
  page,
}) => {
  const w = world();
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  const form = page.getByTestId("match-form");
  await form.getByRole("button", { name: "Ping pong" }).click();
  await form.getByRole("button", { name: "Bertil" }).click();
  await form.getByRole("button", { name: "I won" }).click();
  await form.getByLabel("Your score").fill("3");
  await form.getByLabel("Their score").fill("5");

  await expect(form.getByRole("alert")).toContainText(
    "winner's score must be higher",
  );
  await expect(
    form.getByRole("button", { name: "Report match" }),
  ).toBeDisabled();
  expect(w.reports).toEqual([]);
});

test("a guest with nobody to play against sees a friendly message", async ({
  page,
}) => {
  const w = world({ guests: [] });
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  await expect(page.getByTestId("match-no-opponents")).toContainText(
    "Nobody else has joined yet",
  );
  await expect(page.getByTestId("match-form")).toBeHidden();
});

test("the report flow is hidden while the event has no competitions", async ({
  page,
}) => {
  const w = world({ competitions: [] });
  await fakeCompetitions(page, w);
  await page.goto(`/p/${code}`);

  await expect(page.getByRole("heading", { name: /You're in/ })).toBeVisible();
  await expect(page.getByTestId("guest-matches")).toBeHidden();
});
