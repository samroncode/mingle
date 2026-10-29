// update_hottakes: the host replaces the hot takes that aren't revealed
// yet, between takes or before hot takes start. The handler has already
// validated them with the shared hot takes schema, the same one create_event
// uses. The flow check and the write are one database transaction.
import type {
  UpdateHotTakesRequest,
  UpdateHotTakesResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Hot takes edits per user per event, like update_party_content. */
export const updateHotTakesRateLimit: RateLimitRule = {
  key: "update_hottakes",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal of update_hot_takes answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  busy: { ok: false, error: "invalid_transition" },
  finished: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  too_many: { ok: false, error: "invalid_request" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function updateHotTakes(
  db: Db,
  caller: string,
  request: UpdateHotTakesRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    updateHotTakesRateLimit,
    async (eventId) => {
      const { data: outcome, error } = await db.rpc("update_hot_takes", {
        target_event_id: eventId,
        takes: request.takes,
      });
      if (error) return databaseFailed("update_hot_takes", error);
      if (outcome !== "updated") {
        return refusals[outcome] ?? { ok: false, error: "internal_error" };
      }

      const body: UpdateHotTakesResponse = {};
      return { ok: true, body };
    },
  );
}
