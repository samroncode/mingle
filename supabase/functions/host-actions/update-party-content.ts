// update_party_content: the host replaces the party screen's content (welcome
// text, menu, schedule, wifi, music link). The handler has already validated
// it with the shared PartySchema, the same one create_event uses.
import type {
  UpdatePartyContentRequest,
  UpdatePartyContentResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { authorizeHost } from "./admin-key.ts";
import type { Db } from "./db.ts";
import type { ActionResult } from "./http.ts";
import { consumeEventRateLimit, type RateLimitRule } from "./rate-limit.ts";

/**
 * Content updates per user per event. A host fixes the content now and then
 * during the evening; this leaves room for a few quick saves in a row.
 */
export const updatePartyContentRateLimit: RateLimitRule = {
  key: "update_party_content",
  maxAttempts: 10,
  windowSeconds: 60,
};

export async function updatePartyContent(
  db: Db,
  caller: string,
  request: UpdatePartyContentRequest,
): Promise<ActionResult> {
  const auth = await authorizeHost(db, caller, request.code, request.key);
  if (!auth.ok) return auth;
  if (
    !(await consumeEventRateLimit(
      db,
      caller,
      auth.eventId,
      updatePartyContentRateLimit,
    ))
  ) {
    return { ok: false, error: "rate_limited" };
  }

  const { data: outcome, error } = await db.rpc("update_event_party", {
    target_event_id: auth.eventId,
    party: request.party,
  });
  if (error) {
    console.error("update_event_party failed", error.code);
    return { ok: false, error: "internal_error" };
  }
  // An ended event is frozen, like its flow.
  if (outcome === "ended") return { ok: false, error: "invalid_transition" };
  // The event expired between the key check and the write.
  if (outcome !== "updated") return { ok: false, error: "not_authorized" };

  const body: UpdatePartyContentResponse = {};
  return { ok: true, body };
}
