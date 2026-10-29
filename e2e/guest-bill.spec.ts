import { expect, test } from "@playwright/test";
import { fakeEvent, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";

const bill = {
  payeeName: "Sam",
  swishNumber: "46701234567",
  total: 345,
  confirmed: 0,
  owed: 345,
  status: "owes",
  lines: [
    { name: "Drinks", share: 225 },
    { name: "Cake", share: 120 },
  ],
};

test("a guest sees no sign of money before the bill is sent", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });

  await page.goto(`/p/${code}`);
  await expect(
    page.getByRole("heading", { name: "You're in, Anna!" }),
  ).toBeVisible();

  await expect(page.getByTestId("bill-icon")).toHaveCount(0);
  await expect(page.getByText(/swish|kr\b/i)).toHaveCount(0);
});

test("once the bill is sent the icon shows, and the sheet opens only on a tap", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna", bill });

  await page.goto(`/p/${code}`);
  const icon = page.getByTestId("bill-icon");
  await expect(icon).toBeVisible();
  // A dot while the guest owes something, and no sheet by itself.
  await expect(page.getByTestId("bill-dot")).toBeVisible();
  await expect(page.getByTestId("bill-sheet")).toHaveCount(0);

  await icon.click();
  const sheet = page.getByTestId("bill-sheet");
  await expect(sheet).toContainText("Pay Sam");
  await expect(sheet).toContainText("Swish 0701234567");
  await expect(sheet).toContainText("Drinks");
  await expect(sheet).toContainText("120 kr");
  await expect(sheet).toContainText("345 kr");

  // Pay with Swish: a link carrying the amount, and a QR code for another phone.
  const button = sheet.getByTestId("swish-button");
  await expect(button).toHaveText("Pay with Swish");
  const href = (await button.getAttribute("href")) ?? "";
  expect(href).toMatch(/^swish:\/\/payment\?data=/);
  expect(decodeURIComponent(href)).toContain('"value":345');
  expect(decodeURIComponent(href)).toContain("Mingle");
  await expect(sheet.getByRole("img", { name: /Swish QR/ })).toBeVisible();
  await sheet.screenshot({ path: "/tmp/swish-sheet.png" });

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});

test("the guest says they paid, then takes it back", async ({ page }) => {
  await fakeSupabase(page, []);
  const calls: boolean[] = [];
  await fakeEvent(page, { code, joinedAs: "Anna", bill, iPaidCalls: calls });

  await page.goto(`/p/${code}`);
  await page.getByTestId("bill-icon").click();
  const sheet = page.getByTestId("bill-sheet");
  await sheet.getByTestId("i-paid").click();

  await expect(sheet.getByTestId("bill-says-paid")).toContainText(
    "Sam will confirm",
  );
  await expect(sheet.getByTestId("swish-button")).toHaveCount(0);
  expect(calls).toEqual([true]);

  await sheet.getByRole("button", { name: "I haven't paid after all" }).click();
  await expect(sheet.getByTestId("i-paid")).toBeVisible();
  expect(calls).toEqual([true, false]);
});

test("once the host confirms the sheet says Paid, thanks! and the dot is gone", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, {
    code,
    joinedAs: "Anna",
    bill: { ...bill, confirmed: 345, owed: 0, status: "paid" },
  });

  await page.goto(`/p/${code}`);
  await expect(page.getByTestId("bill-icon")).toBeVisible();
  await expect(page.getByTestId("bill-dot")).toHaveCount(0);

  await page.getByTestId("bill-icon").click();
  const sheet = page.getByTestId("bill-sheet");
  await expect(sheet.getByTestId("bill-paid")).toHaveText("Paid, thanks!");
  await expect(sheet.getByTestId("swish-button")).toHaveCount(0);
  await expect(sheet.getByTestId("i-paid")).toHaveCount(0);
});

test("after a later purchase the guest owes only the rest", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, {
    code,
    joinedAs: "Anna",
    bill: { ...bill, total: 435, confirmed: 345, owed: 90, status: "owes" },
  });

  await page.goto(`/p/${code}`);
  await expect(page.getByTestId("bill-dot")).toBeVisible();
  await page.getByTestId("bill-icon").click();
  const sheet = page.getByTestId("bill-sheet");

  await expect(sheet).toContainText("Paid so far");
  await expect(sheet).toContainText("Left to pay");
  await expect(sheet).toContainText("90 kr");
  const href =
    (await sheet.getByTestId("swish-button").getAttribute("href")) ?? "";
  expect(decodeURIComponent(href)).toContain('"value":90');
});
