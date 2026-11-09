import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "f".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

test.use({
  viewport: { width: 1440, height: 900 },
  isMobile: false,
  hasTouch: false,
});

const quiz = [0, 1, 2].map((position) => ({
  id: `q${position}`,
  position,
  text: `Question ${position + 1}?`,
  options: ["A", "B", "C", "D"],
  correct: 0,
}));

const evening = {
  code,
  enabledModules: ["quiz", "awards", "hottakes"] as const,
  party: {
    welcome: "Welcome!",
    schedule: [
      { time: "00:00", title: "Doors" },
      { time: "23:59", title: "Last dance" },
    ],
  },
  quiz,
  awards: ["Most likely to be late"],
  hottakes: ["Pineapple belongs on pizza"],
  guests: [
    memberRow({ user_id: anna, display_name: "Anna" }),
    memberRow({ user_id: bertil, display_name: "Bertil" }),
  ],
  costs: {
    payeeName: "Sam",
    swishNumber: "46701234567",
    purchases: [
      { id: "p1", name: "Drinks", price: 450, sharers: [anna, bertil] },
    ],
  },
};

test.describe("the host dashboard at 1440 px", () => {
  test("shows the activities in one row and starts one from it", async ({
    page,
  }) => {
    const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}#key=${key}`);

    const quizCell = page.getByTestId("activity-quiz");
    await expect(quizCell).toContainText("3 questions, not started");
    await expect(page.getByTestId("activity-awards")).toBeVisible();
    await expect(page.getByTestId("activity-hottakes")).toBeVisible();
    await expect(page.getByTestId("program-list")).toContainText("Last dance");
    await expect(page.getByTestId("costs-summary")).toContainText(
      "450 kr spent",
    );
    await page.screenshot({ path: "test-results/host-dashboard-idle.png" });

    await quizCell.getByRole("button", { name: "Start quiz" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "start_module", module: "quiz" },
    });
  });

  test("keeps the running state, program and costs on one screen", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
      flow: {
        status: "live",
        current_module: "quiz",
        current_step: 0,
        phase: "open",
      },
    });
    await page.goto(`/host/${code}#key=${key}`);

    await expect(page.getByTestId("now-panel")).toContainText("Question 1?");
    await expect(page.getByTestId("activity-awards")).toContainText(
      "Stop the quiz first",
    );
    await expect(
      page
        .getByTestId("activity-awards")
        .getByRole("button", { name: "Start awards" }),
    ).toBeDisabled();
    await page.screenshot({ path: "test-results/host-dashboard-running.png" });
    // Program and costs start on the first screen: the question and its
    // buttons, and the activities row, sit above them.
    for (const id of ["program-list", "costs-summary"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box?.y ?? Infinity).toBeLessThan(880);
    }
  });

  test("edits an activity in place and switches it off", async ({ page }) => {
    const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}#key=${key}`);

    await page.getByRole("button", { name: "Edit Quiz" }).click();
    const fold = page.getByRole("region", { name: "Quiz" });
    await expect(fold.getByText("1. Question 1?")).toBeVisible();
    await expect(fold.getByRole("button", { name: "Start quiz" })).toHaveCount(
      0,
    );

    await fold.getByRole("switch", { name: "Use this activity" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({
      action: "set_modules",
      modules: ["awards", "hottakes"],
    });
  });

  test("the navigation scrolls to a section and marks it", async ({ page }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}#key=${key}`);

    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav.getByRole("button", { name: /Activities/ })).toContainText(
      "3",
    );
    await expect(nav.getByRole("button", { name: /Guests/ })).toContainText(
      "2",
    );
    await expect(nav.getByRole("button", { name: /Live/ })).toHaveAttribute(
      "aria-current",
      "location",
    );

    await nav.getByRole("button", { name: /^Guests/ }).click();
    await expect(page.locator("#dash-guests")).toBeInViewport();
    await expect(nav.getByRole("button", { name: /^Guests/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
    await page.screenshot({ path: "test-results/host-dashboard-nav.png" });

    await nav.getByRole("button", { name: "End the evening" }).click();
    await expect(page.locator("#dash-event")).toBeInViewport();
  });

  test("opens the program and costs editors in place", async ({ page }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}#key=${key}`);

    await page.getByRole("button", { name: "Edit program" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Open shared costs" }).click();
    await expect(page.getByTestId("host-costs")).toContainText("Drinks");
  });
});
