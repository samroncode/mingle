import type { Page } from "@playwright/test";

/** Opens a control panel section by test id; leaves an open one alone. */
export async function openSection(page: Page, testId: string) {
  const header = page.getByTestId(testId).getByRole("button").first();
  if ((await header.getAttribute("aria-expanded")) === "false") {
    await header.click();
  }
}
