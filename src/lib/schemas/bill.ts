import { z } from "zod";

/**
 * A guest's own bill, as the database function `my_bill` answers it: where
 * to pay, the guest's share of each purchase they are part of, and where
 * they stand with the host. Whole kronor.
 */
export const PaymentStatusSchema = z.enum(["owes", "says_paid", "paid"]);

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const MyBillSchema = z.object({
  payeeName: z.string(),
  /** Normalised, e.g. 46701234567. */
  swishNumber: z.string(),
  total: z.number().int().nonnegative(),
  /** What the host has confirmed as paid, 0 if nothing. */
  confirmed: z.number().int().nonnegative(),
  /** Total minus confirmed, never below 0: what is left to pay. */
  owed: z.number().int().nonnegative(),
  status: PaymentStatusSchema,
  lines: z.array(
    z.object({ name: z.string(), share: z.number().int().positive() }),
  ),
});

export type MyBill = z.infer<typeof MyBillSchema>;
