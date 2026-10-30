import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

// The whole shared costs flow with two phones that share one fake world:
// the host adds a purchase and sends the bill, a guest sees the icon, opens
// the sheet and says "I've paid", and the host confirms.

const code = "ABC234";
const key = "d".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";
const guests = [
  memberRow({ user_id: anna, display_name: "Anna" }),
  memberRow({ user_id: bertil, display_name: "Bertil" }),
];

type Costs = NonNullable<Parameters<typeof fakeHostPanel>[1]["costs"]>;

test("the host sends the bill, a guest says they paid and the host confirms", async ({
  page: hostPage,
  context,
}) => {
  // What the database would hold, changed by the host's actions below.
  const world: {
    costs: Costs | undefined;
    annaSaysPaid: boolean;
    annaConfirmed: boolean;
  } = { costs: undefined, annaSaysPaid: false, annaConfirmed: false };
  const syncPayments = () => {
    if (!world.costs) return;
    world.costs.payments = {
      [anna]: {
        saysPaid: world.annaSaysPaid && !world.annaConfirmed,
        confirmedKr: world.annaConfirmed ? 225 : null,
      },
    };
  };

  await fakeSupabase(hostPage, [
    // Claiming the host link.
    () => [200, {}],
    // Save the purchase.
    () => {
      world.costs = {
        payeeName: "Sam",
        swishNumber: "46701234567",
        billSentAt: null,
        purchases: [
          { id: "p1", name: "Drinks", price: 450, sharers: [anna, bertil] },
        ],
      };
      return [200, {}];
    },
    // Send the bill.
    () => {
      if (world.costs) world.costs.billSentAt = "2026-10-30T20:00:00Z";
      return [200, {}];
    },
    // Claiming the host link again after the reload.
    () => [200, {}],
    // Confirm Anna.
    () => {
      world.annaConfirmed = true;
      syncPayments();
      return [200, {}];
    },
  ]);
  const hostOptions = {
    code,
    enabledModules: [],
    guests,
    get costs() {
      return world.costs;
    },
  };
  await fakeHostPanel(hostPage, hostOptions);

  // 1. The host switches shared costs on, adds a purchase and sends the bill.
  await hostPage.goto(`/host/${code}#key=${key}`);
  const section = hostPage.getByTestId("host-costs");
  await section.getByRole("button", { name: "Shared costs" }).click();
  await section.getByRole("button", { name: "Switch on" }).click();
  await section.getByLabel("Guests pay").fill("Sam");
  await section.getByLabel("Your Swish number").fill("070-123 45 67");
  await section.getByRole("button", { name: "Add a purchase" }).click();
  await section.getByLabel("What you bought").fill("Drinks");
  await section.getByLabel("Price in kr").fill("450");
  await section.getByRole("button", { name: "Save" }).click();
  await expect(section).toContainText("Bill not sent");

  await section.getByRole("button", { name: "Send the bill" }).click();
  await section
    .getByRole("alertdialog")
    .getByRole("button", { name: "Send the bill" })
    .click();
  await expect(section).toContainText("Bill sent");

  // 2. Anna's phone: the icon is there, and "I've paid" reaches the host.
  const billOf = () =>
    world.costs?.billSentAt
      ? {
          payeeName: "Sam",
          swishNumber: "46701234567",
          total: 225,
          confirmed: world.annaConfirmed ? 225 : 0,
          owed: world.annaConfirmed ? 0 : 225,
          status: world.annaConfirmed
            ? "paid"
            : world.annaSaysPaid
              ? "says_paid"
              : "owes",
          lines: [{ name: "Drinks", share: 225 }],
        }
      : null;
  const annaPage = await context.newPage();
  await fakeSupabase(annaPage, []);
  await fakeEvent(annaPage, {
    code,
    joinedAs: "Anna",
    liveBill: billOf,
    onIPaid: (paid) => {
      world.annaSaysPaid = paid;
      syncPayments();
    },
  });
  await annaPage.goto(`/p/${code}`);
  await annaPage.getByTestId("bill-icon").click();
  const sheet = annaPage.getByTestId("bill-sheet");
  await expect(sheet).toContainText("225 kr");
  await sheet.getByTestId("i-paid").click();
  await expect(sheet.getByTestId("bill-says-paid")).toBeVisible();

  // 3. The host sees Says paid and confirms.
  await hostPage.reload();
  const hostSection = hostPage.getByTestId("host-costs");
  await hostSection.getByRole("button", { name: /Shared costs/ }).click();
  const row = hostSection.getByTestId("guest-payment").filter({
    hasText: "Anna",
  });
  await expect(row).toContainText("Says paid");
  await row.getByRole("button", { name: "Confirm" }).click();
  await expect(row).toContainText("Paid");
  await expect(row.getByTestId("payment-status")).toHaveText("Paid");

  // 4. Anna's sheet now says Paid, thanks!
  await annaPage.reload();
  await annaPage.getByTestId("bill-icon").click();
  await expect(annaPage.getByTestId("bill-paid")).toHaveText("Paid, thanks!");
  await expect(annaPage.getByTestId("bill-dot")).toHaveCount(0);
});
