// delete_notice: the host deletes a notice they sent, so it disappears from
// the phones. A notice of another event answers like an unknown one.
import type {
  DeleteNoticeRequest,
  DeleteNoticeResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Deletes per user per event. */
export const deleteNoticeRateLimit: RateLimitRule = {
  key: "delete_notice",
  maxAttempts: 30,
  windowSeconds: 60,
};

export function deleteNotice(
  db: Db,
  caller: string,
  request: DeleteNoticeRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, deleteNoticeRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("delete_notice", {
      target_event_id: eventId,
      notice_id: request.id,
    });
    if (error) return databaseFailed("delete_notice", error);
    if (outcome !== "deleted") return { ok: false, error: "not_found" };

    const body: DeleteNoticeResponse = {};
    return { ok: true, body };
  });
}
