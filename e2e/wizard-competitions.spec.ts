import { expect, test } from "@playwright/test";
import { fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "a".repeat(43);

test("the host switches on Competitions, ticks a suggestion and adds their own", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);
  const next = page.getByRole("button", { name: "Next", exact: true });

  await page.goto("/new");
  await next.click();
  await next.click();
  await expect(page.getByRole("heading", { name: "Activities" })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Competitions" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Competitions" }).click();

  // quiz, awards and hot takes come first.
  for (let i = 0; i < 4; i++) await next.click();
  await expect(
    page.getByRole("heading", { name: "Competitions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0 of 5 competitions picked")).toBeVisible();

  await page.getByRole("button", { name: /Suggested competitions/ }).click();
  await page
    .getByRole("button", { name: "Add the competition: Darts" })
    .click();
  await page.getByRole("button", { name: "Add your own competition" }).click();
  await expect(next).toBeDisabled();
  await page.getByLabel("Name of competition 2").fill("  Beer pong ");
  await expect(next).toBeEnabled();
  await expect(page.getByText("2 of 5 competitions picked")).toBeVisible();

  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("2 competitions")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).toMatchObject({
    action: "create_event",
    competitions: [{ name: "Darts" }, { name: "Beer pong" }],
  });
  expect((bodies[0] as { enabledModules: string[] }).enabledModules).toContain(
    "competitions",
  );
});

test("an event without picked competitions sends none", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);
  const next = page.getByRole("button", { name: "Next", exact: true });

  await page.goto("/new");
  await next.click();
  await next.click();
  await page.getByRole("switch", { name: "Competitions" }).click();
  for (let i = 0; i < 4; i++) await next.click();
  await expect(page.getByText(/No competitions picked/)).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).not.toHaveProperty("competitions");
});
