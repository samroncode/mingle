import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { fakeRun, runEvent } from "./fake-run.ts";

const code = "ABC234";
const key = "d".repeat(43);

async function openRunningQuiz(page: import("@playwright/test").Page) {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz", "awards"],
    status: "live",
    flow: { ...runEvent(code, "aw", "quiz", "open") },
  });
  await fakeRun(page, "open");
  await page.goto(`/host/${code}#key=${key}`);
}

test.describe("phone layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the running activity is on top and its buttons are fixed at the bottom", async ({
    page,
  }) => {
    await openRunningQuiz(page);
    await expect(page.getByTestId("quiz-live").first()).toBeVisible();
    await page.screenshot({
      path: `test-results/${process.env.SHOT ?? "after"}-phone-running.png`,
    });
    const bar = page.getByTestId("host-bottom-bar");
    await expect(bar.getByRole("button", { name: "Reveal" })).toBeVisible();
    await expect(page.getByTestId("tv-now")).toContainText("On the TV:");
    // Buttons are at least 48px high and inside the viewport.
    const box = await bar.getByRole("button", { name: "Reveal" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("nothing running: no bottom bar, activities are flat rows at the top", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz", "awards"],
      status: "live",
    });
    await page.goto(`/host/${code}#key=${key}`);
    await expect(page.getByTestId("activity-quiz")).toBeVisible();
    await expect(page.getByTestId("host-bottom-bar")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/${process.env.SHOT ?? "after"}-phone-idle.png`,
    });
  });
});

test.describe("wide layout", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the phone parts are not rendered", async ({ page }) => {
    await openRunningQuiz(page);
    await expect(page.getByTestId("quiz-live").first()).toBeVisible();
    await expect(page.getByTestId("host-bottom-bar")).toHaveCount(0);
  });
});
