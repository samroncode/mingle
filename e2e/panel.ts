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

/** The Prepare section a test id belongs to; other names are section ids. */
const sectionOfTestId: Record<string, string> = {
  "party-screen": "party",
  "host-costs": "costs",
  "host-guests": "guests",
  "host-messages": "messages",
  "host-winners": "winners",
  "bright-room": "brightroom",
  "event-section": "links",
};

/**
 * Opens a Prepare section from the section list (on a phone, back to the list
 * first). Takes a section id such as `guests` or `end`, or the test id the
 * section's editor carries (`host-guests`, `activity-quiz`).
 */
export async function openSection(page: Page, name: string) {
  await openPrepare(page);
  const section = sectionOfTestId[name] ?? name.replace(/^activity-/, "");
  const link = page.getByTestId(`section-link-${section}`);
  if (!(await link.isVisible())) {
    await page.getByTestId("prepare-back").click();
  }
  await link.click();
  await page.waitForURL((url) => url.searchParams.get("section") === section);
  await page.getByTestId("prepare-editor").waitFor();
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
