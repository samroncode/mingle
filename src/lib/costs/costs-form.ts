import type { CostsView } from "@/api/costs";
import { type Costs, CostsSchema } from "@/lib/schemas/costs";

/** One purchase as the host edits it. The price stays text until saved. */
export type PurchaseForm = {
  /** Stable while editing, so a row keeps its inputs when another is removed. */
  key: string;
  name: string;
  price: string;
  sharers: string[];
};

export type CostsForm = {
  payeeName: string;
  swishNumber: string;
  purchases: PurchaseForm[];
};

/** Which parts of the form failed the checks. */
export type CostsFormErrors = {
  payeeName: boolean;
  swishNumber: boolean;
  purchases: { name: boolean; price: boolean; sharers: boolean }[];
};

let keyCount = 0;

/** A new purchase shared by every guest, the common case. */
export function newPurchaseForm(guestIds: readonly string[]): PurchaseForm {
  keyCount += 1;
  return {
    key: `new-${keyCount}`,
    name: "",
    price: "",
    sharers: [...guestIds],
  };
}

/** National form of a stored number: 46701234567 → 0701234567. */
export function nationalNumber(stored: string): string {
  return stored.startsWith("46") ? `0${stored.slice(2)}` : stored;
}

/**
 * The saved costs as the form edits them, or an empty form while shared costs
 * are off. Sharers who are no longer guests are left out, as the database
 * would refuse them.
 */
export function costsToForm(
  costs: CostsView | null,
  guestIds: readonly string[],
): CostsForm {
  if (!costs) return { payeeName: "", swishNumber: "", purchases: [] };
  const current = new Set(guestIds);
  return {
    payeeName: costs.payeeName,
    swishNumber: nationalNumber(costs.swishNumber),
    purchases: costs.purchases.map((purchase) => ({
      key: purchase.id,
      name: purchase.name,
      price: String(purchase.price),
      sharers: purchase.sharers.filter((id) => current.has(id)),
    })),
  };
}

export type CostsFormResult =
  { ok: true; costs: Costs } | { ok: false; errors: CostsFormErrors };

/** A price typed as whole kronor, or NaN. "1 200" counts, "12,5" does not. */
export function parsePrice(text: string): number {
  const digits = text.replace(/\s/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** Checks the form with the same schema host-actions uses. */
export function parseCostsForm(form: CostsForm): CostsFormResult {
  const parsed = CostsSchema.safeParse({
    payeeName: form.payeeName,
    swishNumber: form.swishNumber,
    purchases: form.purchases.map((purchase) => ({
      name: purchase.name,
      price: parsePrice(purchase.price),
      sharers: purchase.sharers,
    })),
  });
  if (parsed.success) return { ok: true, costs: parsed.data };

  const errors: CostsFormErrors = {
    payeeName: false,
    swishNumber: false,
    purchases: form.purchases.map(() => ({
      name: false,
      price: false,
      sharers: false,
    })),
  };
  for (const issue of parsed.error.issues) {
    const [part, index, field] = issue.path;
    if (part === "payeeName") errors.payeeName = true;
    if (part === "swishNumber") errors.swishNumber = true;
    if (part === "purchases" && typeof index === "number") {
      const purchase = errors.purchases[index];
      if (purchase && (field === "name" || field === "price"))
        purchase[field] = true;
      if (purchase && field === "sharers") purchase.sharers = true;
    }
  }
  return { ok: false, errors };
}

/** Whether any part of the form failed. */
export function hasErrors(errors: CostsFormErrors): boolean {
  return (
    errors.payeeName ||
    errors.swishNumber ||
    errors.purchases.some((p) => p.name || p.price || p.sharers)
  );
}
