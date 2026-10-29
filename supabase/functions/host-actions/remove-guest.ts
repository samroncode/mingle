// remove_guest: the host removes a guest from the evening. The database does
// the removal in one transaction (the removed time, the guest's answers and
// votes on unrevealed items, the counts), and only for a guest of this event
// who isn't removed yet.
import type {
  RemoveGuestRequest,
  RemoveGuestResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Removals per user per event. */
export const removeGuestRateLimit: RateLimitRule = {
  key: "remove_guest",
  maxAttempts: 30,
  windowSeconds: 60,
};

/** What each refusal of remove_guest answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  // Not a guest of this event, or already removed.
  not_found: { ok: false, error: "not_found" },
  // The event expired between the key check and the write.
  no_event: { ok: false, error: "not_authorized" },
};

export function removeGuest(
  db: Db,
  caller: string,
  request: RemoveGuestRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, removeGuestRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("remove_guest", {
      target_event_id: eventId,
      target_user_id: request.userId,
    });
    if (error) return databaseFailed("remove_guest", error);
    if (outcome !== "removed") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: RemoveGuestResponse = {};
    return { ok: true, body };
  });
}
