import type { PurchaseView } from "@/api/costs";

/** A guest's share of a purchase: the price over the sharers, rounded up to a whole krona. */
export function shareOf(price: number, sharerCount: number): number {
  return Math.ceil(price / sharerCount);
}

/** The sharers who are still guests. A removed guest leaves the count at once. */
export function currentSharers(
  purchase: Pick<PurchaseView, "sharers">,
  guestIds: ReadonlySet<string>,
): string[] {
  return purchase.sharers.filter((id) => guestIds.has(id));
}

/**
 * The host's one-line summary: `spent` is the sum of the prices, `owed` what
 * the current guests owe together (shares are rounded up, so it can be a
 * little more than spent). A purchase whose sharers have all been removed
 * has nobody to pay it. Nothing is confirmed yet, so nothing is subtracted.
 */
export function costsTotals(
  purchases: readonly PurchaseView[],
  guestIds: ReadonlySet<string>,
): { spent: number; owed: number } {
  let spent = 0;
  let owed = 0;
  for (const purchase of purchases) {
    spent += purchase.price;
    const count = currentSharers(purchase, guestIds).length;
    if (count > 0) owed += shareOf(purchase.price, count) * count;
  }
  return { spent, owed };
}

/** Whole kronor as the UI writes them in both languages: "120 kr". */
export function formatKr(amount: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(amount)} kr`;
}
