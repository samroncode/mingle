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

const withCosts = (billSentAt: string | null) => ({
  payeeName: "Sam",
  swishNumber: "46701234567",
  billSentAt,
  purchases: [
    { id: "p1", name: "Drinks", price: 450, sharers: [anna, bertil] },
  ],
});

test("the host sends the bill after a confirm", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: withCosts(null),
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  await expect(section).toContainText("Bill not sent");
  await section.getByRole("button", { name: /Shared costs/ }).click();
  await section.getByRole("button", { name: "Send the bill" }).click();
  // Nothing is sent until the confirm.
  expect(
    bodies.some(
      (body) => (body as { action?: string }).action === "set_bill_sent",
    ),
  ).toBe(false);
  await expect(section).toContainText("Send the bill?");
  await section
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send the bill" })
    .click();

  await expect
    .poll(() => bodies.at(-1))
    .toEqual({
      action: "set_bill_sent",
      code,
      key,
      sent: true,
    });
});

test("the host hides a sent bill", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: withCosts("2026-10-29T20:00:00Z"),
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  await expect(section).toContainText("Bill sent");
  await section.getByRole("button", { name: /Shared costs/ }).click();
  // Each guest's share is listed.
  await expect(section).toContainText("What each guest pays");
  await section.getByRole("button", { name: "Hide the bill" }).click();

  await expect
    .poll(() => bodies.at(-1))
    .toEqual({
      action: "set_bill_sent",
      code,
      key,
      sent: false,
    });
});

const sentWith = (
  payments: Record<string, { saysPaid?: boolean; confirmedKr?: number }>,
) => ({ ...withCosts("2026-10-29T20:00:00Z"), payments });

test("the host sees Owes, Says paid and Paid, and confirms a guest who says they paid", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: sentWith({ [anna]: { saysPaid: true } }),
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  await section.getByRole("button", { name: /Shared costs/ }).click();
  const rows = section.getByTestId("guest-payment");
  await expect(rows.filter({ hasText: "Anna" })).toContainText("Says paid");
  await expect(rows.filter({ hasText: "Bertil" })).toContainText("Owes");

  await rows
    .filter({ hasText: "Anna" })
    .getByRole("button", { name: "Confirm" })
    .click();

  await expect
    .poll(() => bodies.at(-1))
    .toEqual({
      action: "set_payment",
      code,
      key,
      userId: anna,
      change: "confirm",
    });
});

test("the host marks a guest paid in cash and undoes a confirmation", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    costs: sentWith({ [anna]: { confirmedKr: 225 } }),
  });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-costs");
  // Spent 450, Anna's 225 is confirmed: one line shows what is still owed.
  await expect(section).toContainText("450 kr spent · 225 kr still owed");
  await section.getByRole("button", { name: /Shared costs/ }).click();
  const rows = section.getByTestId("guest-payment");
  await expect(rows.filter({ hasText: "Anna" })).toContainText("Paid");

  await rows
    .filter({ hasText: "Bertil" })
    .getByRole("button", { name: "Mark as paid" })
    .click();
  await expect
    .poll(() => bodies.at(-1))
    .toMatchObject({ change: "confirm", userId: bertil });

  await rows
    .filter({ hasText: "Anna" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect
    .poll(() => bodies.at(-1))
    .toMatchObject({ change: "undo", userId: anna });
});
