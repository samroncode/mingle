import { expect, test } from "@playwright/test";
import { fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "a".repeat(43);

/** Next on the niche and language steps, then open the activities step. */
async function toActivities(page: import("@playwright/test").Page) {
  await page.goto("/new");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Activities" })).toBeVisible();
}

test("skipping shared costs creates an event without them", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await toActivities(page);
  await expect(
    page.getByRole("switch", { name: "Shared costs" }),
  ).not.toBeChecked();
  await expect(page.getByText(/Step 3 of 11/)).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("Guests pay")).toHaveCount(0);
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).not.toHaveProperty("costs");
});

test("switching on shared costs adds a step and sends the costs", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await toActivities(page);
  await page.getByRole("switch", { name: "Shared costs" }).click();
  await expect(page.getByText(/Step 3 of 12/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  // Next waits for the name and number; a wrong number says so.
  await expect(
    page.getByRole("heading", { name: "Shared costs" }),
  ).toBeVisible();
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeDisabled();
  await page.getByLabel("Guests pay").fill("Sam");
  await page.getByLabel("Your Swish number").fill("12345");
  await expect(page.getByRole("alert")).toContainText("Check this field");
  await expect(next).toBeDisabled();
  await page.getByLabel("Your Swish number").fill("070-123 45 67");
  await expect(next).toBeEnabled();

  // A purchase needs a name and a whole-kronor price, or to be removed.
  await page.getByRole("button", { name: "Add a purchase" }).click();
  await expect(next).toBeDisabled();
  await page.getByLabel("What you bought (purchase 1)").fill("Drinks");
  await page.getByLabel("Price in kr (purchase 1)").fill("12,5");
  await expect(page.getByRole("alert")).toContainText("Check this field");
  await page.getByLabel("Price in kr (purchase 1)").fill("450");
  await expect(next).toBeEnabled();

  // A reload keeps what was typed.
  await page.reload();
  await expect(page.getByLabel("Price in kr (purchase 1)")).toHaveValue("450");
  await next.click();

  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByText("Guests pay Sam · 1 purchase")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).toMatchObject({
    costs: {
      payeeName: "Sam",
      swishNumber: "46701234567",
      purchases: [{ name: "Drinks", price: 450 }],
    },
  });
});

test("skipping the shared costs step switches them off", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await toActivities(page);
  await page.getByRole("switch", { name: "Shared costs" }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByLabel("Guests pay").fill("Sam");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome text" }),
  ).toBeVisible();
  await expect(page.getByText(/Step 7 of 11/)).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByText("Guests pay")).toHaveCount(0);
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).not.toHaveProperty("costs");
});
