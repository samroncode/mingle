import { expect, test, type Page, type Route } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase, supabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);

const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";
const m1 = "00000000-0000-4000-8000-0000000000c1";
const m2 = "00000000-0000-4000-8000-0000000000c2";

interface Match {
  id: string;
  competition_id: string;
  winner_id: string;
  loser_id: string;
  winner_score: number | null;
  loser_score: number | null;
  reporter_id: string;
  created_at: string;
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

/** Two matches, the newer first: Anna beat Bertil at darts, Bertil at ping pong. */
function twoMatches(): Match[] {
  return [
    {
      id: m2,
      competition_id: "c2",
      winner_id: anna,
      loser_id: bertil,
      winner_score: null,
      loser_score: null,
      reporter_id: anna,
      created_at: "2026-11-09T20:10:00Z",
    },
    {
      id: m1,
      competition_id: "c1",
      winner_id: bertil,
      loser_id: anna,
      winner_score: 21,
      loser_score: 15,
      reporter_id: bertil,
      created_at: "2026-11-09T20:00:00Z",
    },
  ];
}

/** Opens the panel with `matches` as the fake database's rows. */
async function openPanel(
  page: Page,
  matches: Match[],
  answers: Array<() => [number, object]>,
) {
  const bodies = await fakeSupabase(page, [() => [200, {}], ...answers]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["competitions"],
    status: "live",
    competitions: [
      { id: "c1", name: "Ping pong" },
      { id: "c2", name: "Darts" },
    ],
    guests: [
      memberRow({ user_id: anna, display_name: "Anna" }),
      memberRow({ user_id: bertil, display_name: "Bertil" }),
    ],
  });
  await page.route(`${supabase}/rest/v1/competition_matches*`, (route) =>
    json(route, 200, matches),
  );
  await page.goto(`/host/${code}#key=${key}`);
  await openSection(page, "activity-competitions");
  return { bodies, section: page.getByTestId("competitions-matches") };
}

test("the host sees the matches newest first, with who reported each", async ({
  page,
}) => {
  const { section } = await openPanel(page, twoMatches(), []);

  const items = section.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("Darts");
  await expect(items.nth(0)).toContainText("Anna beat Bertil");
  await expect(items.nth(0)).toContainText("Reported by Anna");
  await expect(items.nth(1)).toContainText("Ping pong");
  await expect(items.nth(1)).toContainText("Bertil beat Anna");
  await expect(items.nth(1)).toContainText("21–15");
  await expect(items.nth(1)).toContainText("Reported by Bertil");
});

test("the host corrects the winner and the score of a match", async ({
  page,
}) => {
  const matches = twoMatches();
  const { bodies, section } = await openPanel(page, matches, [
    () => {
      const [, old] = matches;
      if (old) {
        old.winner_id = anna;
        old.loser_id = bertil;
        old.winner_score = 21;
        old.loser_score = 19;
      }
      return [200, {}];
    },
  ]);

  await section
    .getByRole("button", { name: "Edit the Ping pong match: Bertil beat Anna" })
    .click();
  await section.getByRole("button", { name: "Anna", exact: true }).click();
  // The 21 and 15 now belong to Anna and Bertil.
  await section.getByLabel("Score of Bertil").fill("19");
  await section.getByRole("button", { name: "Save" }).click();

  await expect(section).toContainText("Anna beat Bertil21–19");
  expect(bodies[1]).toEqual({
    action: "update_match",
    code,
    key,
    change: {
      type: "edit",
      id: m1,
      winnerId: anna,
      score: { winner: 21, loser: 19 },
    },
  });
});

test("a score that doesn't fit stops the host before anything is sent", async ({
  page,
}) => {
  const { bodies, section } = await openPanel(page, twoMatches(), []);

  await section
    .getByRole("button", { name: "Edit the Ping pong match: Bertil beat Anna" })
    .click();
  await section.getByLabel("Score of Bertil").fill("10");
  await section.getByLabel("Score of Anna").fill("10");

  await expect(section.getByRole("alert")).toContainText("must be higher");
  await expect(section.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(bodies).toHaveLength(1);
});

test("the host deletes a match after a confirm", async ({ page }) => {
  const matches = twoMatches();
  const { bodies, section } = await openPanel(page, matches, [
    () => {
      matches.shift();
      return [200, {}];
    },
  ]);

  await section
    .getByRole("button", { name: "Delete the Darts match: Anna beat Bertil" })
    .click();
  await expect(
    section.getByText("Delete the match where Anna beat Bertil?"),
  ).toBeVisible();
  expect(bodies).toHaveLength(1);
  await section.getByRole("button", { name: "Delete match" }).click();

  await expect(section.getByRole("listitem")).toHaveCount(1);
  await expect(section).not.toContainText("Darts");
  expect(bodies[1]).toEqual({
    action: "update_match",
    code,
    key,
    change: { type: "delete", id: m2 },
  });
});

test("cancelling the delete confirmation sends nothing", async ({ page }) => {
  const { bodies, section } = await openPanel(page, twoMatches(), []);

  await section
    .getByRole("button", { name: "Delete the Darts match: Anna beat Bertil" })
    .click();
  await section.getByRole("button", { name: "Cancel" }).click();

  await expect(section.getByRole("listitem")).toHaveCount(2);
  expect(bodies).toHaveLength(1);
});

test("a failed delete shows a try-again message and keeps the match", async ({
  page,
}) => {
  const { section } = await openPanel(page, twoMatches(), [
    () => [500, { error: "internal_error" }],
  ]);

  await section
    .getByRole("button", { name: "Delete the Darts match: Anna beat Bertil" })
    .click();
  await section.getByRole("button", { name: "Delete match" }).click();

  await expect(section.getByRole("alert")).toContainText(
    "Something went wrong",
  );
  await expect(section.getByRole("listitem")).toHaveCount(2);
});

test("a match that is already gone is said so", async ({ page }) => {
  const { section } = await openPanel(page, twoMatches(), [
    () => [404, { error: "not_found" }],
  ]);

  await section
    .getByRole("button", { name: "Delete the Darts match: Anna beat Bertil" })
    .click();
  await section.getByRole("button", { name: "Delete match" }).click();

  await expect(section.getByRole("alert")).toContainText("already gone");
});
