// send_notice: the host sends a short text to every guest's phone. The
// handler has already validated and trimmed the text with the shared schema;
// the database checks it again and holds the limits (30 per event, 5 seconds
// apart) and raises `notices_version`, which the phones follow.
import type {
  SendNoticeRequest,
  SendNoticeResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Sends per user per event; the database's own 5 seconds apart is stricter. */
export const sendNoticeRateLimit: RateLimitRule = {
  key: "send_notice",
  maxAttempts: 20,
  windowSeconds: 60,
};

/** What each refusal of send_notice answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "ended" },
  too_many: { ok: false, error: "too_many" },
  too_soon: { ok: false, error: "too_soon" },
  invalid: { ok: false, error: "invalid_request" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function sendNotice(
  db: Db,
  caller: string,
  request: SendNoticeRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, sendNoticeRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("send_notice", {
      target_event_id: eventId,
      notice_text: request.text,
    });
    if (error) return databaseFailed("send_notice", error);
    if (outcome !== "sent") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: SendNoticeResponse = {};
    return { ok: true, body };
  });
}
