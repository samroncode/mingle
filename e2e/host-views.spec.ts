import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeRun, runEvent } from "./fake-run.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openPrepare, openRun } from "./panel.ts";

const code = "ABC234";
const key = "e".repeat(43);

const guests = [
  memberRow({
    user_id: "00000000-0000-4000-8000-0000000000a1",
    display_name: "Anna",
  }),
];

async function idle(page: import("@playwright/test").Page) {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz", "awards"],
    guests,
  });
}

async function running(page: import("@playwright/test").Page) {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz", "awards"],
    status: "live",
    guests,
    flow: { ...runEvent(code, "aw", "quiz", "open") },
  });
  await fakeRun(page, "open");
}

test("Prepare is the first view; the switch goes to Run and back", async ({
  page,
}) => {
  await idle(page);
  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByTestId("prepare-view")).toBeVisible();
  await expect(page.getByTestId("run-work-area")).toHaveCount(0);

  await openRun(page);
  await expect(page.getByTestId("now-panel")).toBeVisible();
  await expect(page.getByTestId("prepare-view")).toHaveCount(0);
  // The fragment keeps the admin key alone, and survives the switch.
  expect(new URL(page.url()).hash).toBe(`#key=${key}`);

  await openPrepare(page);
  await expect(page.getByTestId("prepare-view")).toBeVisible();
  await expect(page.getByTestId("now-panel")).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe(`#key=${key}`);
});

test("the switch lists Prepare first and marks the current view", async ({
  page,
}) => {
  await idle(page);
  await page.goto(`/host/${code}#key=${key}`);
  const group = page.getByRole("navigation", {
    name: "Run or prepare the evening",
  });
  const links = group.getByRole("link");
  await expect(links.first()).toHaveText("Prepare");
  await expect(links.last()).toHaveText("Run the evening");
  await expect(links.first()).toHaveAttribute("aria-current", "page");
  await group.getByRole("link", { name: "Run the evening" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    group.getByRole("link", { name: "Run the evening" }),
  ).toHaveAttribute("aria-current", "page");
});

test("the view and section come from the query and survive a reload", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz", "awards"],
    guests,
  });
  await page.goto(`/host/${code}?view=prepare&section=guests#key=${key}`);
  const guestsSection = page.getByTestId("host-guests");
  await expect(guestsSection.getByText("Anna")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("host-guests").getByText("Anna")).toBeVisible();
});

test("an unknown view or section falls back to Prepare", async ({ page }) => {
  await idle(page);
  await page.goto(`/host/${code}?view=nope&section=nope#key=${key}`);
  await expect(page.getByTestId("prepare-view")).toBeVisible();
});

test("the guest count in the top bar opens Prepare with the guests", async ({
  page,
}) => {
  await idle(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  await page.getByTestId("host-top-bar").getByTestId("guest-count").click();
  await expect(page.getByTestId("host-guests").getByText("Anna")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("section")).toBe("guests");
});

test("in Prepare the top bar says what is on the TV and leads back to Run", async ({
  page,
}) => {
  await running(page);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  const tv = page.getByTestId("host-top-bar").getByTestId("tv-now");
  await expect(tv).toContainText("On the TV:");
  await expect(tv).toContainText("Quiz");
  await tv.click();
  await expect(page.getByTestId("run-work-area")).toBeVisible();
});

test("Run has no On the TV line in the bar and Stop exists once", async ({
  page,
}) => {
  await running(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  await expect(page.getByTestId("quiz-live").first()).toBeVisible();
  await expect(
    page.getByTestId("host-top-bar").getByTestId("tv-now"),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(1);
});

test("the top bar is one line", async ({ page }) => {
  await idle(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  const bar = await page.getByTestId("host-top-bar").boundingBox();
  expect(bar?.height).toBeLessThan(80);
  await expect(
    page.getByTestId("host-top-bar").getByRole("group", { name: "Language" }),
  ).toBeVisible();
});

test("the phone has two tabs at the bottom, and the wide screen a switch in the bar", async ({
  page,
}) => {
  await idle(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  const phone = (page.viewportSize()?.width ?? 0) < 1024;
  if (phone) {
    const tabs = page.getByTestId("view-tabs");
    await expect(tabs).toBeVisible();
    await expect(page.getByTestId("view-switch")).toHaveCount(0);
    const box = await tabs.getByRole("link", { name: "Prepare" }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 0,
    );
  } else {
    await expect(
      page.getByTestId("host-top-bar").getByTestId("view-switch"),
    ).toBeVisible();
    await expect(page.getByTestId("view-tabs")).toHaveCount(0);
  }
});

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  // A string expression, because the e2e tsconfig has no DOM types.
  const overflow = await page.evaluate<number>(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("Run (idle and running) and Prepare never scroll sideways", async ({
  page,
}) => {
  await idle(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  await expect(page.getByTestId("run-work-area")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await openPrepare(page);
  await expectNoHorizontalScroll(page);

  await page.unrouteAll();
  await running(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);
  await expect(page.getByTestId("run-work-area")).toBeVisible();
  await expectNoHorizontalScroll(page);
});
