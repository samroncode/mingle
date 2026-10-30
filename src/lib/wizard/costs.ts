import { parsePrice } from "@/lib/costs/costs-form";
import {
  costsLimits,
  type WizardCosts,
  WizardCostsSchema,
} from "@/lib/schemas/costs";
import { getNiche, type NicheId } from "@/niches";

/** A purchase as the host types it. The price stays text until it is checked. */
export interface CostPurchaseDraft {
  /** Stable while editing, so a row keeps its inputs when another is removed. */
  key: string;
  name: string;
  price: string;
}

/**
 * The shared costs part of the wizard draft. `enabled` is the switch on the
 * activities step; the step only exists while it is on. Plain data, so it can
 * be saved as JSON.
 */
export interface CostsDraft {
  enabled: boolean;
  payeeName: string;
  swishNumber: string;
  purchases: CostPurchaseDraft[];
}

/** Which parts of the costs step failed the checks. */
export interface CostsDraftErrors {
  payeeName: boolean;
  swishNumber: boolean;
  purchases: { name: boolean; price: boolean }[];
}

/** Shared costs as a niche starts them: switched on or off, nothing typed. */
export function emptyCosts(niche: NicheId): CostsDraft {
  return {
    enabled: getNiche(niche).defaultSharedCosts,
    payeeName: "",
    swishNumber: "",
    purchases: [],
  };
}

let keyCount = 0;

export function newCostPurchase(): CostPurchaseDraft {
  keyCount += 1;
  return { key: `cost-${keyCount}`, name: "", price: "" };
}

export type CostsAction =
  | { type: "set_enabled"; enabled: boolean }
  | { type: "set_payee"; payeeName: string }
  | { type: "set_swish"; swishNumber: string }
  | { type: "add_purchase" }
  | { type: "change_purchase"; key: string; part: Partial<CostPurchaseDraft> }
  | { type: "remove_purchase"; key: string };

export function costsReducer(
  costs: CostsDraft,
  action: CostsAction,
): CostsDraft {
  switch (action.type) {
    case "set_enabled":
      return { ...costs, enabled: action.enabled };
    case "set_payee":
      return { ...costs, payeeName: action.payeeName };
    case "set_swish":
      return { ...costs, swishNumber: action.swishNumber };
    case "add_purchase":
      return costs.purchases.length >= costsLimits.purchases
        ? costs
        : { ...costs, purchases: [...costs.purchases, newCostPurchase()] };
    case "change_purchase":
      return {
        ...costs,
        purchases: costs.purchases.map((purchase) =>
          purchase.key === action.key
            ? { ...purchase, ...action.part, key: purchase.key }
            : purchase,
        ),
      };
    case "remove_purchase":
      return {
        ...costs,
        purchases: costs.purchases.filter(
          (purchase) => purchase.key !== action.key,
        ),
      };
  }
}

export type CostsResult =
  { ok: true; costs: WizardCosts } | { ok: false; errors: CostsDraftErrors };

/** Checks the typed costs with the schema `create_event` uses. */
export function parseCosts(costs: CostsDraft): CostsResult {
  const parsed = WizardCostsSchema.safeParse({
    payeeName: costs.payeeName,
    swishNumber: costs.swishNumber,
    purchases: costs.purchases.map((purchase) => ({
      name: purchase.name,
      price: parsePrice(purchase.price),
    })),
  });
  if (parsed.success) return { ok: true, costs: parsed.data };

  const errors: CostsDraftErrors = {
    payeeName: false,
    swishNumber: false,
    purchases: costs.purchases.map(() => ({ name: false, price: false })),
  };
  for (const issue of parsed.error.issues) {
    const [part, index, field] = issue.path;
    if (part === "payeeName") errors.payeeName = true;
    if (part === "swishNumber") errors.swishNumber = true;
    if (part === "purchases" && typeof index === "number") {
      const purchase = errors.purchases[index];
      if (purchase && (field === "name" || field === "price"))
        purchase[field] = true;
    }
  }
  return { ok: false, errors };
}

/** Whether the costs break the schema. Always false while switched off. */
export function costsInvalid(costs: CostsDraft): boolean {
  return costs.enabled && !parseCosts(costs).ok;
}
