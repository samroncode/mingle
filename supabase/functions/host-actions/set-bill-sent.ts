// set_bill_sent: the host sends the bill to the guests, or hides it again.
// Until it is sent, guests can read nothing about money; the database
// answers `my_bill` with null.
import type {
  SetBillSentRequest,
  SetBillSentResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Sends and hides per user per event. */
export const setBillSentRateLimit: RateLimitRule = {
  key: "set_bill_sent",
  maxAttempts: 20,
  windowSeconds: 60,
};

/** What each refusal of set_bill_sent answers. */
const refusals: Record<string, ActionResult> = {
  // Shared costs aren't switched on, so there is no bill.
  costs_off: { ok: false, error: "invalid_transition" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function setBillSent(
  db: Db,
  caller: string,
  request: SetBillSentRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, setBillSentRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("set_bill_sent", {
      target_event_id: eventId,
      sent: request.sent,
    });
    if (error) return databaseFailed("set_bill_sent", error);
    if (outcome !== "sent" && outcome !== "hidden") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: SetBillSentResponse = {};
    return { ok: true, body };
  });
}
