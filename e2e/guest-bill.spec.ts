import { expect, test } from "@playwright/test";
import { fakeEvent, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";

const bill = {
  payeeName: "Sam",
  swishNumber: "46701234567",
  total: 345,
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

  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
});
