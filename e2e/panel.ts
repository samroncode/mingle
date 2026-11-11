import type { Page } from "@playwright/test";

/** The control panel's Run / Prepare switch: top bar on wide screens, tabs on a phone. */
function viewSwitch(page: Page) {
  return page.getByRole("navigation", { name: "Run or prepare the evening" });
}

/** Opens the Prepare view (the host link's view query is `prepare`). */
export async function openPrepare(page: Page) {
  if (new URL(page.url()).searchParams.get("view") !== "prepare") {
    await viewSwitch(page).getByRole("link", { name: "Prepare" }).click();
    await page.waitForURL(/view=prepare/);
  }
  await page.getByTestId("prepare-view").waitFor();
}

/** Goes back to the Run view. */
export async function openRun(page: Page) {
  await viewSwitch(page).getByRole("link", { name: "Run the evening" }).click();
  await page.waitForURL((url) => !url.searchParams.has("view"));
}

/** Opens a Prepare section by test id; leaves an open one alone. */
export async function openSection(page: Page, testId: string) {
  await openPrepare(page);
  const header = page.getByTestId(testId).getByRole("button").first();
  if ((await header.getAttribute("aria-expanded")) === "false") {
    await header.click();
  }
}

/** The dashboard layout starts at 1024 px; below it the panel is one column. */
export function isDesktop(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/** Opens an activity's editor in Prepare and returns it. */
export async function openActivity(page: Page, id: string) {
  await openSection(page, `activity-${id}`);
  return page.getByTestId(`activity-${id}`);
}
