import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openActivity, openSection } from "./panel.ts";

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

test.describe("the host control panel at 1440 px", () => {
  test("Run lists the activities with Start only and starts one", async ({
    page,
  }) => {
    const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);

    const quizCell = page.getByTestId("activity-quiz");
    await expect(
      page.getByRole("heading", { name: "The party screen is on the TV" }),
    ).toBeVisible();
    await expect(quizCell).toContainText("3 questions, not started");
    await expect(quizCell).toContainText("Up next");
    await expect(page.getByTestId("activity-awards")).toBeVisible();
    await expect(page.getByTestId("activity-hottakes")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Sections" }),
    ).toHaveCount(0);
    // Only the quiz, which is up next, has the primary (coral) Start.
    await expect(
      page.getByTestId("run-work-area").locator('[data-variant="default"]'),
    ).toHaveCount(1);
    await expect(
      quizCell.getByRole("button", { name: "Start quiz" }),
    ).toHaveAttribute("data-variant", "default");
    await expect(
      page
        .getByTestId("activity-awards")
        .getByRole("button", { name: "Start awards" }),
    ).toHaveAttribute("data-variant", "link");
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

  test("Run keeps the running state and the side column on one screen", async ({
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
    await page.goto(`/host/${code}?view=run#key=${key}`);

    await expect(page.getByTestId("now-panel")).toContainText("Question 1?");
    const others = page.getByTestId("run-others");
    await expect(others).toContainText("Awards");
    await expect(others.getByRole("button")).toHaveCount(0);
    await expect(page.getByText("Stop the quiz first")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(1);
    await expect(
      page.getByTestId("run-work-area").locator('[data-variant="default"]'),
    ).toHaveCount(1);
    await expect(
      page.getByTestId("run-work-area").getByRole("button", { name: "Reveal" }),
    ).toHaveAttribute("data-variant", "default");
    await expect(page.getByTestId("host-side")).toBeVisible();
    await page.screenshot({ path: "test-results/host-dashboard-running.png" });
  });

  test("a quiet Start sends the same action as the primary one", async ({
    page,
  }) => {
    const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    await page.getByRole("button", { name: "Start awards" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "start_module", module: "awards" },
    });
  });

  test("an activity without a Start of its own offers Open", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: ["competitions"],
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    await page
      .getByTestId("activity-competitions")
      .getByRole("link", { name: "Open" })
      .click();
    await expect(page.getByTestId("prepare-view")).toBeVisible();
    await expect(page).toHaveURL(/section=competitions/);
  });

  test("with no countable activity left no Start is primary", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: ["wheel", "competitions"],
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    await expect(page.getByTestId("run-work-area")).toBeVisible();
    await expect(
      page.getByTestId("run-work-area").locator('[data-variant="default"]'),
    ).toHaveCount(0);
  });

  test("Prepare edits an activity and switches it off", async ({ page }) => {
    const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);

    const quiz = await openActivity(page, "quiz");
    await expect(quiz.getByText("1. Question 1?")).toBeVisible();
    await page.screenshot({ path: "test-results/host-dashboard-prepare.png" });

    await quiz.getByRole("switch", { name: "Use this activity" }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1]).toMatchObject({
      action: "set_modules",
      modules: ["awards", "hottakes"],
    });
  });

  test("Prepare opens the program and the shared costs", async ({ page }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      ...evening,
      enabledModules: [...evening.enabledModules],
    });
    await page.goto(`/host/${code}?view=prepare&section=costs#key=${key}`);

    await expect(page.getByTestId("host-costs")).toContainText("Drinks");
    await openSection(page, "party-screen");
    await expect(page.getByTestId("party-screen")).toContainText("Last dance");
  });
});
