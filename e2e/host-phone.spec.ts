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
  await page.goto(`/host/${code}?view=run#key=${key}`);
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
    // Buttons are at least 48px high and inside the viewport, above the tabs.
    const box = await bar.getByRole("button", { name: "Reveal" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    const tabs = await page.getByTestId("view-tabs").boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      tabs?.y ?? 0,
    );
    expect((tabs?.y ?? 0) + (tabs?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("the bottom bar stays put when the page is scrolled", async ({
    page,
  }) => {
    await openRunningQuiz(page);
    const bar = page.getByTestId("host-bottom-bar");
    await expect(bar).toBeVisible();
    const edge = async () => {
      const box = await bar.boundingBox();
      return (box?.y ?? 0) + (box?.height ?? 0);
    };
    const before = await edge();
    await page.mouse.wheel(0, 3000);
    expect(await edge()).toBe(before);
    expect(before).toBeLessThanOrEqual(844);
  });

  test("a failed button shows its error inside the bar", async ({ page }) => {
    await fakeSupabase(page, [
      () => [200, {}],
      () => [409, { error: "invalid_transition" }],
    ]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz", "awards"],
      status: "live",
      flow: { ...runEvent(code, "aw", "quiz", "open") },
    });
    await fakeRun(page, "open");
    await page.goto(`/host/${code}?view=run#key=${key}`);
    const bar = page.getByTestId("host-bottom-bar");
    await bar.getByRole("button", { name: "Reveal" }).click();
    await expect(bar.getByRole("alert")).toBeVisible();
  });

  test("nothing running: no bottom bar, the activities are rows with a Start", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz", "awards"],
      status: "live",
    });
    await page.goto(`/host/${code}?view=run#key=${key}`);
    await expect(page.getByTestId("activity-quiz")).toBeVisible();
    await expect(page.getByTestId("host-bottom-bar")).toHaveCount(0);
    await expect(page.getByTestId("view-tabs")).toBeVisible();
    const start = page
      .getByTestId("activity-quiz")
      .getByRole("button", { name: "Start quiz" });
    expect((await start.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    const scroll = await page.evaluate<number>(
      "document.documentElement.scrollWidth",
    );
    const client = await page.evaluate<number>(
      "document.documentElement.clientWidth",
    );
    expect(scroll).toBeLessThanOrEqual(client);
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
