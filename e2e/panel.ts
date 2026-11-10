import type { Page } from "@playwright/test";

/** Opens a control panel section by test id; leaves an open one alone. */
export async function openSection(page: Page, testId: string) {
  const header = page.getByTestId(testId).getByRole("button").first();
  if ((await header.getAttribute("aria-expanded")) === "false") {
    await header.click();
  }
}

/** The dashboard layout starts at 1024 px; below it the panel is one column. */
export function isDesktop(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 1024;
}

/**
 * Opens an activity for editing and returns where its editor is: the
 * accordion row on a phone, the fold under the activities row on a desktop.
 */
export async function openActivity(page: Page, id: string, name: string) {
  if (!isDesktop(page)) {
    await openSection(page, `activity-${id}`);
    return page.getByTestId(`activity-${id}`);
  }
  const fold = page.getByRole("region", { name });
  if ((await fold.count()) === 0) {
    await page.getByRole("button", { name: `Edit ${name}` }).click();
  }
  return fold;
}
