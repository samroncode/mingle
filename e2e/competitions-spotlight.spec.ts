import { expect, test } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import {
  fakeHostPanel,
  fakeSupabase,
  fakeTv,
  supabase,
} from "./fake-supabase.ts";
import { openActivity } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

const competitions = [
  { id: "c1", name: "Ping pong" },
  { id: "c2", name: "Darts" },
];

const spotlight = (step: number) => ({
  status: "live",
  current_module: "competitions",
  current_step: step,
  phase: "idle",
});

test.describe("the control panel", () => {
  test("the host shows a table on the TV and says why a refusal happened", async ({
    page,
  }) => {
    const bodies = await fakeSupabase(page, [
      () => [200, {}],
      () => [409, { error: "invalid_transition" }],
      () => [
        200,
        {
          status: "live",
          currentModule: "competitions",
          currentStep: 1,
          phase: "idle",
        },
      ],
    ]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["competitions"],
      status: "live",
      competitions,
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    const fold = await openActivity(page, "competitions");
    const spot = fold.getByTestId("competitions-spotlight");

    await expect(spot.getByTestId("competitions-spotlight-state")).toHaveText(
      "Nothing is on the TV. Pick a table to show it in full screen.",
    );

    await spot.getByRole("button", { name: "Show Ping pong on TV" }).click();
    await expect(spot.getByRole("alert")).toContainText(
      "The table can't be shown right now.",
    );
    expect(bodies[1]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "start_module", module: "competitions", competition: 0 },
    });

    await spot.getByRole("button", { name: "Show Darts on TV" }).click();
    expect(bodies[2]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "start_module", module: "competitions", competition: 1 },
    });
  });

  test("shows what is on the TV and stops it", async ({ page }) => {
    const bodies = await fakeSupabase(page, [
      () => [200, {}],
      () => [
        200,
        { status: "live", currentModule: null, currentStep: 0, phase: "idle" },
      ],
    ]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["competitions"],
      competitions,
      flow: spotlight(1),
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    // The Now panel (desktop) or the activity row (phone) says what is shown.
    const state = page.getByTestId("competitions-spotlight-state").first();
    await expect(state).toHaveText("On the TV now: Darts");
    await page.getByRole("button", { name: "Stop showing" }).first().click();
    expect(bodies[1]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "stop_module" },
    });
  });
});

test.describe("the TV", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("shows the table of the competition in the spotlight, best first", async ({
    page,
  }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: {
        ...eventRow({
          id: "e1",
          code,
          enabled_modules: ["competitions"],
          ...spotlight(1),
        }),
        members: [
          memberRow({ user_id: "t", role: "tv", display_name: null }),
          memberRow({ user_id: anna, role: "guest", display_name: "Anna" }),
          memberRow({ user_id: bertil, role: "guest", display_name: "Bertil" }),
        ],
      },
    });
    await page.route(`${supabase}/rest/v1/competitions*`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: JSON.stringify(
          competitions.map((c, position) => ({ ...c, position })),
        ),
      }),
    );
    await page.route(`${supabase}/rest/v1/competition_matches*`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "content-type": "application/json",
        },
        body: JSON.stringify([
          {
            id: "m1",
            competition_id: "c2",
            winner_id: bertil,
            loser_id: anna,
            winner_score: 21,
            loser_score: 15,
            created_at: "2026-11-09T20:00:00Z",
          },
        ]),
      }),
    );

    await page.goto(`/tv/${code}`);

    const tv = page.getByTestId("competitions-tv");
    await expect(tv.getByRole("heading", { name: "Darts" })).toBeVisible();
    const rows = tv.getByTestId("competitions-table").getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText("Bertil");
    await expect(rows.nth(1)).toContainText("+6");
    await expect(rows.nth(2)).toContainText("Anna");
    if (process.env.SHOTS) {
      await page.screenshot({ path: `${process.env.SHOTS}/after-tv.png` });
    }
  });
});
