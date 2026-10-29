import { z } from "zod";

/**
 * A guest's own bill, as the database function `my_bill` answers it: where
 * to pay, and the guest's share of each purchase they are part of. Whole
 * kronor.
 */
export const MyBillSchema = z.object({
  payeeName: z.string(),
  /** Normalised, e.g. 46701234567. */
  swishNumber: z.string(),
  total: z.number().int().nonnegative(),
  lines: z.array(
    z.object({ name: z.string(), share: z.number().int().positive() }),
  ),
});

export type MyBill = z.infer<typeof MyBillSchema>;
