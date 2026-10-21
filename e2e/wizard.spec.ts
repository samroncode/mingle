import { expect, test } from "@playwright/test";
import { fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "a".repeat(43);

test("creates an event through the wizard", async ({ page }) => {
  const bodies = await fakeSupabase(page, [
    () => [429, { error: "rate_limited" }],
    () => [200, { code, key }],
    () => [200, {}],
  ]);

  await page.goto("/");
  await page.getByRole("link", { name: "Create an event" }).click();

  // Niche, then language (starts on the UI language), then activities.
  await expect(page.getByRole("button", { name: /Afterwork/ })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("main").getByRole("button", { name: "English" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("main").getByRole("button", { name: "Svenska" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("switch", { name: "Awards" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // Summary shows the choices.
  await expect(page.getByText("Quiz, Hot takes")).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: "Svenska" }),
  ).toBeVisible();

  // A failed create keeps the input and shows a plain message.
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many tries");
  await expect(page.getByText("Quiz, Hot takes")).toBeVisible();

  // The retry succeeds.
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  expect(bodies).toEqual([
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party: {},
    },
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party: {},
    },
  ]);

  const origin = new URL(page.url()).origin;
  await expect(page.getByTestId("host-link")).toHaveText(
    `${origin}/host/${code}#key=${key}`,
  );
  await expect(page.getByTestId("tv-address")).toHaveText(
    `${origin}/tv/${code}`,
  );
  await expect(page.getByRole("alert")).toContainText("can't be shown again");

  await page.getByRole("link", { name: "Open the control panel" }).click();
  await expect(page).toHaveURL(`${origin}/host/${code}#key=${key}`);

  // The control panel claims the event and shows the code and links again.
  await expect(page.getByTestId("event-code")).toHaveText(code);
  await expect(page.getByTestId("host-link")).toHaveText(
    `${origin}/host/${code}#key=${key}`,
  );
  expect(bodies.at(-1)).toEqual({ action: "claim_host", code, key });
});
