// update_match: the host fixes the winner or score of a reported match, or
// deletes it. Each change is one database function that locks the event and
// only touches a match of this event.
import type {
  MatchChange,
  UpdateMatchRequest,
  UpdateMatchResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Fixes per user per event: a few taps in a row, not a loop. */
export const updateMatchRateLimit: RateLimitRule = {
  key: "update_match",
  maxAttempts: 30,
  windowSeconds: 60,
};

/** What each refusal of the match functions answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  invalid_winner: { ok: false, error: "invalid_request" },
  invalid_score: { ok: false, error: "invalid_request" },
  score_mismatch: { ok: false, error: "invalid_request" },
  // No such match in this event, whether it is gone or another event's.
  unknown: { ok: false, error: "not_found" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

type RpcAnswer = {
  data: string | null;
  error: { code: string } | null;
};

/** The database function for the change, with its success code. */
function callFor(
  db: Db,
  eventId: string,
  change: MatchChange,
): { name: string; success: string; call: PromiseLike<RpcAnswer> } {
  switch (change.type) {
    case "edit":
      return {
        name: "edit_match",
        success: "edited",
        call: db.rpc("edit_match", {
          target_event_id: eventId,
          match_id: change.id,
          new_winner: change.winnerId,
          new_winner_score: change.score?.winner,
          new_loser_score: change.score?.loser,
        }),
      };
    case "delete":
      return {
        name: "delete_match",
        success: "deleted",
        call: db.rpc("delete_match", {
          target_event_id: eventId,
          match_id: change.id,
        }),
      };
  }
}

export function updateMatch(
  db: Db,
  caller: string,
  request: UpdateMatchRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, updateMatchRateLimit, async (eventId) => {
    const { name, success, call } = callFor(db, eventId, request.change);
    const { data: outcome, error } = await call;
    if (error) return databaseFailed(name, error);
    if (outcome !== success) {
      return refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" };
    }

    const body: UpdateMatchResponse = {};
    return { ok: true, body };
  });
}
