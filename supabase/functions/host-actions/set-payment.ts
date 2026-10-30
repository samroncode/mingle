// set_payment: the host confirms a guest's payment (or marks them paid
// directly), or undoes a confirmation. The amounts live in the database,
// which stores the guest's current total, so nothing a client sends decides
// how much was paid.
import type {
  SetPaymentRequest,
  SetPaymentResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Confirmations and undos per user per event. */
export const setPaymentRateLimit: RateLimitRule = {
  key: "set_payment",
  maxAttempts: 60,
  windowSeconds: 60,
};

/** What each refusal of set_payment answers. */
const refusals: Record<string, ActionResult> = {
  // Shared costs aren't switched on, so there is nothing to settle.
  costs_off: { ok: false, error: "invalid_transition" },
  // Not a current guest of the event.
  not_found: { ok: false, error: "not_found" },
};

export function setPayment(
  db: Db,
  caller: string,
  request: SetPaymentRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, setPaymentRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("set_payment", {
      target_event_id: eventId,
      target_user_id: request.userId,
      change: request.change,
    });
    if (error) return databaseFailed("set_payment", error);
    if (outcome !== "confirmed" && outcome !== "undone") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: SetPaymentResponse = {};
    return { ok: true, body };
  });
}
