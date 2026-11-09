import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, fakeTv, supabase } from "./fake-supabase.ts";

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

const competitions = [
  { id: "c1", position: 0, name: "Ping pong" },
  { id: "c2", position: 1, name: "Darts" },
];

const members = [
  memberRow({ user_id: "u1", display_name: "Anna" }),
  memberRow({ user_id: "g-bertil", display_name: "Bertil" }),
  memberRow({ user_id: "g-cecilia", display_name: "Cecilia" }),
  memberRow({ user_id: "t1", role: "tv" }),
];

const snapshot = {
  ...eventRow({ code, enabled_modules: ["competitions"], status: "live" }),
  members,
};

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Fakes the competitions and matches reads; the test changes `matches`. */
async function fakeTables(page: Page, matches: Match[]) {
  await page.route(`${supabase}/rest/v1/competitions*`, (route) =>
    json(route, competitions),
  );
  await page.route(`${supabase}/rest/v1/competition_matches*`, (route) =>
    json(route, matches),
  );
}

const match = (id: string, over: Partial<Match>): Match => ({
  id,
  competition_id: "c1",
  winner_id: "u1",
  loser_id: "g-bertil",
  winner_score: null,
  loser_score: null,
  created_at: "2026-11-09T20:00:00Z",
  ...over,
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a table appears after a match is reported, with my row highlighted", async ({
    page,
  }) => {
    const matches: Match[] = [];
    await fakeSupabase(page, []);
    await fakeEvent(page, { code, joinedAs: "Anna" });
    await page.route(`${supabase}/rest/v1/events*`, (route) => {
      if (!route.request().url().includes("id=eq.")) return route.fallback();
      return json(route, [snapshot]);
    });
    await fakeTables(page, matches);
    await page.route(`${supabase}/rest/v1/rpc/report_match`, (route) => {
      matches.push(match("m1", { winner_score: 11, loser_score: 7 }));
      return json(route, "reported");
    });
    await page.goto(`/p/${code}`);

    await expect(page.getByTestId("guest-matches")).toBeVisible();
    await expect(page.getByTestId("guest-standings")).toBeHidden();

    const form = page.getByTestId("match-form");
    await form.getByRole("button", { name: "Ping pong" }).click();
    await form.getByRole("button", { name: "Bertil" }).click();
    await form.getByRole("button", { name: "I won" }).click();
    await form.getByRole("button", { name: "Report match" }).click();

    const table = page.getByTestId("standings-table");
    await expect(table).toBeVisible();
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Anna");
    await expect(rows.nth(0)).toHaveAttribute("data-mine", "true");
    await expect(rows.nth(0)).toContainText("+4");
    await expect(rows.nth(1)).toContainText("Bertil");
    await expect(rows.nth(1)).toContainText("−4");
    await page.screenshot({ path: "test-results/standings-phone.png" });
  });
});

test.describe("on the TV", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("a competition with a match gets a table in the rotation", async ({
    page,
  }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, { snapshot });
    await fakeTables(page, [
      match("m1", { winner_score: 21, loser_score: 15 }),
      match("m2", { winner_id: "g-cecilia", loser_id: "u1" }),
    ]);
    await page.goto(`/tv/${code}`);

    const part = page.getByRole("region", { name: "Ping pong" });
    await expect(part).toBeVisible();
    await expect(part.locator("tbody tr")).toHaveCount(3);
    await expect(part.locator("tbody tr").nth(0)).toContainText("Cecilia");
    // Darts has no match, so it has no table.
    await expect(page.getByRole("region", { name: "Darts" })).toBeHidden();
    await page.screenshot({ path: "test-results/standings-tv.png" });
  });

  test("nothing shows while no match has been played", async ({ page }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, { snapshot });
    await fakeTables(page, []);
    await page.goto(`/tv/${code}`);

    await expect(page.getByTestId("tv-code")).toHaveText(code);
    await expect(page.getByTestId("standings-table")).toBeHidden();
  });
});
