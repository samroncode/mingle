import type { PaymentView } from "@/api/costs";
import type { PaymentStatus } from "@/lib/schemas/bill";
import { owedOf } from "./shares";

/**
 * Where a guest stands, as the database computes it for `my_bill`: Paid when
 * the host has confirmed and nothing is owed, Says paid while the guest says
 * so and the host hasn't confirmed, otherwise Owes. A guest whose total grew
 * after a confirmation is back to Owes for the rest.
 */
export function paymentStatus(
  total: number,
  payment?: PaymentView,
): PaymentStatus {
  if (payment?.confirmedKr != null && owedOf(total, payment) === 0)
    return "paid";
  if (payment?.saysPaid) return "says_paid";
  return "owes";
}
