import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

/** What the fake database holds, which the test changes as the awards move. */
interface AwardsWorld {
  /** The phase the awards are in; the reveal ends the voting. */
  phase?: "open" | "revealed";
  /** The guest's stored vote (a user id). */
  votedFor: string | null;
  /** The requests that wrote a vote. */
  writes: Array<{ method: string; body: unknown }>;
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

/**
 * Fakes the awards on a guest's phone on top of `fakeEvent`: the event with
 * the awards open on category 1 and three guests, the category, and the
 * guest's own vote row (insert, change, read).
 */
async function fakeAwards(page: Page, world: AwardsWorld) {
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, 200, [
      {
        ...eventRow({
          code,
          enabled_modules: ["awards"],
          status: "live",
          current_module: "awards",
          current_step: 0,
          phase: world.phase ?? "open",
        }),
        members: [
          memberRow({ display_name: "Anna" }),
          memberRow({ user_id: "g3", display_name: "Cecilia" }),
          memberRow({ user_id: "g2", display_name: "Bertil" }),
          memberRow({ user_id: "t1", role: "tv" }),
        ],
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/rpc/award_progress`, (route) =>
    json(route, 200, [{ total: 2, revealed: 0 }]),
  );
  await page.route(`${supabase}/rest/v1/award_categories*`, (route) =>
    json(route, 200, [
      {
        id: "c1",
        position: 0,
        text: "Most likely to dance on a table",
        vote_count: 0,
        revealed_at: world.phase === "revealed" ? "2026-10-29T20:00:00Z" : null,
      },
    ]),
  );
  await page.route(`${supabase}/rest/v1/rpc/award_winners`, (route) =>
    json(route, 200, [{ user_id: "g2", votes: 4 }]),
  );
  await page.route(`${supabase}/rest/v1/rpc/my_award_votes`, (route) =>
    json(route, 200, [{ votes: 2 }]),
  );
  await page.route(`${supabase}/rest/v1/award_votes*`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            request.headers()["access-control-request-headers"] ?? "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    if (request.method() === "GET") {
      return json(
        route,
        200,
        world.votedFor === null ? [] : [{ voted_for_id: world.votedFor }],
      );
    }
    const body = request.postDataJSON() as { voted_for_id: string };
    world.writes.push({ method: request.method(), body });
    if (request.method() === "PATCH") {
      if (world.votedFor === null) return json(route, 200, []);
      world.votedFor = body.voted_for_id;
      return json(route, 200, [{ voted_for_id: body.voted_for_id }]);
    }
    world.votedFor = body.voted_for_id;
    return route.fulfill({
      status: 201,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test("a guest votes for another guest and changes the vote", async ({
  page,
}) => {
  const world: AwardsWorld = { votedFor: null, writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeAwards(page, world);

  await page.goto(`/p/${code}`);
  const awards = page.getByTestId("awards-guest");
  await expect(awards.getByRole("heading")).toHaveText(
    "Most likely to dance on a table",
  );
  // A to Z, without the guest's own name, the host or the TV.
  const buttons = awards.getByRole("button");
  await expect(buttons).toHaveText(["Bertil", "Cecilia"]);

  await buttons.nth(0).click();
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "true");
  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(buttons.nth(0)).toHaveAttribute("aria-pressed", "false");
  expect(world.writes).toMatchObject([
    { method: "PATCH", body: { voted_for_id: "g2" } },
    { method: "POST", body: { voted_for_id: "g2", category_id: "c1" } },
    { method: "PATCH", body: { voted_for_id: "g3" } },
  ]);
});

test("after the reveal a guest sees the winner and their own votes", async ({
  page,
}) => {
  const world: AwardsWorld = { phase: "revealed", votedFor: "g2", writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeAwards(page, world);

  await page.goto(`/p/${code}`);
  const awards = page.getByTestId("awards-guest");
  await expect(awards.getByTestId("awards-winner")).toHaveText(
    "Bertil, 4 votes",
  );
  await expect(awards.getByTestId("awards-my-votes")).toHaveText(
    "You got 2 votes",
  );
  // Voting is over: no buttons any more.
  await expect(awards.getByRole("button")).toHaveCount(0);
});
