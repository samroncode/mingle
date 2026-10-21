// update_party_content: the host replaces the party screen's content (welcome
// text, menu, schedule, wifi, music link). The handler has already validated
// it with the shared PartySchema, the same one create_event uses.
import type {
  UpdatePartyContentRequest,
  UpdatePartyContentResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/**
 * Content updates per user per event. A host fixes the content now and then
 * during the evening; this leaves room for a few quick saves in a row.
 */
export const updatePartyContentRateLimit: RateLimitRule = {
  key: "update_party_content",
  maxAttempts: 10,
  windowSeconds: 60,
};

export function updatePartyContent(
  db: Db,
  caller: string,
  request: UpdatePartyContentRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    updatePartyContentRateLimit,
    async (eventId) => {
      const { data: outcome, error } = await db.rpc("update_event_party", {
        target_event_id: eventId,
        party: request.party,
      });
      if (error) return databaseFailed("update_event_party", error);
      // An ended event is frozen, like its flow.
      if (outcome === "ended") {
        return { ok: false, error: "invalid_transition" };
      }
      // The event expired between the key check and the write.
      if (outcome !== "updated") return { ok: false, error: "not_authorized" };

      const body: UpdatePartyContentResponse = {};
      return { ok: true, body };
    },
  );
}
