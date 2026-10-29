// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of shared costs; the database checks the same ones. */
export const costsLimits = {
  payeeName: 40,
  purchaseName: 40,
  /** Whole kronor. */
  priceMin: 1,
  priceMax: 100_000,
  /** Purchases in one event. */
  purchases: 50,
  /** Guests sharing one purchase: more than an event can hold. */
  sharers: 200,
} as const;

/** A normalised Swedish mobile number: 46, then 70, 72, 73, 76 or 79 and seven digits. */
export const SWISH_NUMBER_PATTERN = /^46(70|72|73|76|79)\d{7}$/;

/**
 * Turns what a host types ("070-123 45 67", "+46 70 123 45 67", "0046701234567")
 * into the stored form ("46701234567"), or null when it isn't a Swedish
 * mobile number. Spaces, dashes and parentheses are ignored.
 */
export function normalizeSwishNumber(input: string): string | null {
  const compact = input.replace(/[\s\-()]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  const digits = compact.replace(/^\+/, "");
  const national = digits.startsWith("0046")
    ? `0${digits.slice(4)}`
    : digits.startsWith("46")
      ? `0${digits.slice(2)}`
      : digits;
  const normalized = `46${national.replace(/^0/, "")}`;
  return national.startsWith("0") && SWISH_NUMBER_PATTERN.test(normalized)
    ? normalized
    : null;
}

export const SwishNumberSchema = z.string().transform((value, context) => {
  const normalized = normalizeSwishNumber(value);
  if (normalized === null) {
    context.addIssue({
      code: "custom",
      message: "not a Swedish mobile number",
    });
    return z.NEVER;
  }
  return normalized;
});

/** A purchase and the guests who share it (user ids): at least one. */
export const PurchaseSchema = z.strictObject({
  name: z.string().trim().min(1).max(costsLimits.purchaseName),
  /** Whole kronor. */
  price: z.number().int().min(costsLimits.priceMin).max(costsLimits.priceMax),
  sharers: z
    .array(z.uuid())
    .min(1)
    .max(costsLimits.sharers)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate sharer"),
});

export type Purchase = z.infer<typeof PurchaseSchema>;

/** Who guests pay, where, and what for. */
export const CostsSchema = z.strictObject({
  payeeName: z.string().trim().min(1).max(costsLimits.payeeName),
  swishNumber: SwishNumberSchema,
  purchases: z.array(PurchaseSchema).max(costsLimits.purchases),
});

export type Costs = z.infer<typeof CostsSchema>;
