import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

const members = [
  memberRow({ user_id: "u1", display_name: "Anna" }),
  memberRow({ user_id: "g-bertil", display_name: "Bertil" }),
];

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

async function openSummary(page: Page, enabled: string[], matches: unknown[]) {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna", status: "ended" });
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, [
      {
        ...eventRow({ code, enabled_modules: enabled, status: "ended" }),
        members,
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/competitions*`, (route) =>
    json(route, [{ id: "c1", position: 0, name: "Ping pong" }]),
  );
  await page.route(`${supabase}/rest/v1/competition_matches*`, (route) =>
    json(route, matches),
  );
  await page.goto(`/p/${code}/summary`);
}

const played = [
  {
    id: "m1",
    competition_id: "c1",
    winner_id: "g-bertil",
    loser_id: "u1",
    winner_score: 11,
    loser_score: 7,
    created_at: "2026-11-09T20:00:00Z",
  },
];

test.use({ viewport: { width: 390, height: 844 } });

test("the summary shows each competition's winner and table", async ({
  page,
}) => {
  await openSummary(page, ["competitions"], played);

  const part = page.getByRole("region", { name: "Ping pong" });
  await expect(part).toBeVisible();
  await expect(part.getByTestId("competition-winner")).toHaveText(
    "Winner: Bertil",
  );
  await expect(part.locator("tbody tr")).toHaveCount(2);
  await page.screenshot({ path: "test-results/competitions-summary.png" });
});

test("nothing shows when no match was reported", async ({ page }) => {
  await openSummary(page, ["competitions"], []);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("summary-competitions")).toBeHidden();
});

test("nothing shows when competitions is switched off", async ({ page }) => {
  await openSummary(page, [], played);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("summary-competitions")).toBeHidden();
});
