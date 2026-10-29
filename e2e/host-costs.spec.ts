import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";
const guests = [
  memberRow({ user_id: anna, display_name: "Anna" }),
  memberRow({ user_id: bertil, display_name: "Bertil" }),
];

test("the host switches on shared costs and adds a purchase", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  // Closed to start with, and nothing about money in the one line yet.
  await expect(section.getByText("Not switched on")).toHaveCount(0);

  await section.getByRole("button", { name: "Shared costs" }).click();
  await section.getByRole("button", { name: "Switch on" }).click();
  await section.getByLabel("Guests pay").fill("Sam");
  await section.getByLabel("Your Swish number").fill("070-123 45 67");
  await section.getByRole("button", { name: "Add a purchase" }).click();
  await section.getByLabel("What you bought").fill("Drinks");
  await section.getByLabel("Price in kr").fill("450");
  await section.getByLabel("Bertil").uncheck();
  await section.getByRole("button", { name: "Save" }).click();

  await expect(section.getByRole("button", { name: "Save" })).toHaveCount(0);
  expect(bodies.at(-1)).toEqual({
    action: "update_costs",
    code,
    key,
    costs: {
      payeeName: "Sam",
      swishNumber: "46701234567",
      purchases: [{ name: "Drinks", price: 450, sharers: [anna] }],
    },
  });
});

test("a purchase nobody shares, a bad number and a bad price are not sent", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  await section.getByRole("button", { name: "Shared costs" }).click();
  await section.getByRole("button", { name: "Switch on" }).click();
  await section.getByLabel("Guests pay").fill("Sam");
  await section.getByLabel("Your Swish number").fill("12345");
  await section.getByRole("button", { name: "Add a purchase" }).click();
  await section.getByLabel("What you bought").fill("Drinks");
  await section.getByLabel("Price in kr").fill("0");
  await section.getByLabel("Anna").uncheck();
  await section.getByLabel("Bertil").uncheck();
  await section.getByRole("button", { name: "Save" }).click();

  await expect(section.getByText("Pick at least one guest.")).toBeVisible();
  await expect(section.getByText("Check this field.")).toHaveCount(2);
  expect(bodies).toHaveLength(1);
});

test("shared costs show spent and still owed in one line, closed", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: {
      payeeName: "Sam",
      swishNumber: "46701234567",
      purchases: [
        { id: "p1", name: "Drinks", price: 450, sharers: [anna, bertil] },
        { id: "p2", name: "Cake", price: 100, sharers: [anna, bertil, "gone"] },
      ],
    },
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");

  // 450 over two = 225 each; 100 over the two current sharers = 50 each.
  await expect(section).toContainText("550 kr spent · 550 kr still owed");
  await expect(section.getByText("Drinks")).toHaveCount(0);

  await section.getByRole("button", { name: /Shared costs/ }).click();
  await expect(section).toContainText("Guests pay Sam on Swish 0701234567");
  await expect(section).toContainText("Shared by 2 guests, 225 kr each");
  await expect(section).toContainText("Shared by 2 guests, 50 kr each");
});

test("the host switches shared costs off after a confirm", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: { payeeName: "Sam", swishNumber: "46701234567", purchases: [] },
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  await section.getByRole("button", { name: /Shared costs/ }).click();
  await section.getByRole("button", { name: "Switch off" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "The Swish number and all purchases are deleted.",
  );
  expect(bodies).toHaveLength(1);

  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Switch off" })
    .click();

  await expect
    .poll(() => bodies.at(-1))
    .toEqual({ action: "update_costs", code, key, costs: null });
});
