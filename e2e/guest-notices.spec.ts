import { expect, test, type Page } from "@playwright/test";
import { fakeNotices, type FakeNotice } from "./fake-notices.ts";
import { fakeRun, runEvent } from "./fake-run.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

/** Fires what a phone does when the guest comes back to the tab. */
function becomeVisible(page: Page) {
  // A string expression, because the e2e tsconfig has no DOM types.
  return page.evaluate('document.dispatchEvent(new Event("visibilitychange"))');
}

const dinner: FakeNotice = {
  id: "n1",
  text: "Dinner is served",
  created_at: "2026-10-22T11:00:00Z",
};
const taxi: FakeNotice = {
  id: "n2",
  text: "Taxi leaves at 01:00",
  created_at: "2026-10-22T12:00:00Z",
};
// Sent before the fake guest joined (2026-10-22T10:00:00Z).
const old: FakeNotice = {
  id: "n0",
  text: "Doors open",
  created_at: "2026-10-22T09:00:00Z",
};

test("a message shows as a banner, is dismissed for good, and a later one shows again", async ({
  page,
}) => {
  const world = { notices: [dinner] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => world.notices);

  await page.goto(`/p/${code}`);
  const banner = page.getByRole("status");
  await expect(banner).toContainText("Dinner is served");

  await banner.getByRole("button", { name: "Dismiss message" }).click();
  await expect(banner).toHaveCount(0);
  // Still in the list, and still hidden after a reload.
  await expect(page.getByTestId("notice-list")).toContainText(
    "Dinner is served",
  );
  await page.reload();
  await expect(page.getByTestId("notice-list")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);

  // A later message shows again, with the earlier one still in the list.
  world.notices = [dinner, taxi];
  await becomeVisible(page);
  await expect(page.getByRole("status")).toContainText("Taxi leaves at 01:00");
});

test("a message deleted by the host disappears from the phone", async ({
  page,
}) => {
  const world = { notices: [dinner] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => world.notices);

  await page.goto(`/p/${code}`);
  await expect(page.getByRole("status")).toContainText("Dinner is served");

  world.notices = [];
  await becomeVisible(page);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByTestId("notice-list")).toHaveCount(0);
});

test("a guest who joined after a message gets no banner but sees it in the list", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => [old, taxi]);

  await page.goto(`/p/${code}`);
  const banner = page.getByRole("status");
  await expect(banner).toContainText("Taxi leaves at 01:00");
  await expect(banner).not.toContainText("Doors open");
  await expect(banner).not.toContainText("more");
  const list = page.getByTestId("notice-list");
  await expect(list).toContainText("Doors open");
  await expect(list).toContainText("Taxi leaves at 01:00");
});

test("several waiting messages show the newest with how many more", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => [dinner, taxi]);

  await page.goto(`/p/${code}`);
  await expect(page.getByRole("status")).toContainText("Taxi leaves at 01:00");
  await expect(page.getByRole("status")).toContainText("+1 more");
});

test("html and links in a message are shown as plain text", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => [
    { ...dinner, text: "<b>Bold</b> https://example.com" },
  ]);

  await page.goto(`/p/${code}`);
  const banner = page.getByRole("status");
  await expect(banner).toContainText("<b>Bold</b> https://example.com");
  await expect(banner.locator("b, a")).toHaveCount(0);
});

test("it works when localStorage throws", async ({ page }) => {
  await page.addInitScript(() => {
    const boom = () => {
      throw new Error("denied");
    };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
  });
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeNotices(page, () => [dinner]);

  await page.goto(`/p/${code}`);
  const banner = page.getByRole("status");
  await expect(banner).toContainText("Dinner is served");
  // Dismissing still hides it for now, even though it cannot be remembered.
  await banner.getByRole("button", { name: "Dismiss message" }).click();
  await expect(banner).toHaveCount(0);
});

test("the banner does not cover or block the quiz answers", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return route.fulfill({
      status: 200,
      headers: {
        "access-control-allow-origin": "*",
        "content-type": "application/json",
      },
      body: JSON.stringify([runEvent(code, "aw", "quiz", "open")]),
    });
  });
  await fakeRun(page, "open");
  await fakeNotices(page, () => [dinner]);

  await page.goto(`/p/${code}`);
  const banner = page.getByRole("status");
  await expect(banner).toContainText("Dinner is served");

  const bannerBox = await banner.boundingBox();
  const options = page.getByTestId("quiz-guest").getByRole("button");
  await expect(options.first()).toBeVisible();
  for (const option of await options.all()) {
    const box = await option.boundingBox();
    expect(box && bannerBox).toBeTruthy();
    // The banner sits above every answer in the page flow.
    expect(box!.y).toBeGreaterThanOrEqual(bannerBox!.y + bannerBox!.height);
    // And nothing sits on top of the answer: a tap would reach it.
    await option.click({ trial: true });
  }
});
