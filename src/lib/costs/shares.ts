import type { PaymentView, PurchaseView } from "@/api/costs";

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
 * the current guests still owe together (shares are rounded up, so it can be
 * a little more than spent). A purchase whose sharers have all been removed
 * has nobody to pay it. What the host has confirmed is subtracted per guest.
 */
export function costsTotals(
  purchases: readonly PurchaseView[],
  guestIds: ReadonlySet<string>,
  payments: ReadonlyMap<string, PaymentView> = new Map(),
): { spent: number; owed: number } {
  const spent = purchases.reduce((sum, purchase) => sum + purchase.price, 0);
  let owed = 0;
  for (const [id, total] of guestTotals(purchases, [...guestIds])) {
    owed += owedOf(total, payments.get(id));
  }
  return { spent, owed };
}

/** What a guest still owes: their total minus what the host confirmed. */
export function owedOf(total: number, payment?: PaymentView): number {
  return Math.max(total - (payment?.confirmedKr ?? 0), 0);
}

/** Whole kronor as the UI writes them in both languages: "120 kr". */
export function formatKr(amount: number): string {
  return `${new Intl.NumberFormat("sv-SE").format(amount)} kr`;
}

/**
 * What each current guest owes in total, from the purchases they share. A
 * guest who shares nothing owes 0. Used for the host's list; the guest's own
 * bill comes from the database.
 */
export function guestTotals(
  purchases: readonly PurchaseView[],
  guestIds: readonly string[],
): Map<string, number> {
  const current = new Set(guestIds);
  const totals = new Map(guestIds.map((id) => [id, 0]));
  for (const purchase of purchases) {
    const sharers = currentSharers(purchase, current);
    for (const id of sharers) {
      totals.set(
        id,
        (totals.get(id) ?? 0) + shareOf(purchase.price, sharers.length),
      );
    }
  }
  return totals;
}
