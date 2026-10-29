// update_awards: the host replaces the award categories that aren't revealed
// yet, between categories or before the awards start. The handler has already
// validated them with the shared awards schema, the same one create_event
// uses. The flow check and the write are one database transaction.
import type {
  UpdateAwardsRequest,
  UpdateAwardsResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Awards edits per user per event, like update_party_content. */
export const updateAwardsRateLimit: RateLimitRule = {
  key: "update_awards",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal of update_award_categories answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  busy: { ok: false, error: "invalid_transition" },
  finished: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  too_many: { ok: false, error: "invalid_request" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function updateAwards(
  db: Db,
  caller: string,
  request: UpdateAwardsRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, updateAwardsRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("update_award_categories", {
      target_event_id: eventId,
      categories: request.categories,
    });
    if (error) return databaseFailed("update_award_categories", error);
    if (outcome !== "updated") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: UpdateAwardsResponse = {};
    return { ok: true, body };
  });
}
