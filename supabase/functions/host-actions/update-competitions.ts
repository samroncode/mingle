// update_competitions: the host adds, renames, removes and reorders the
// event's competitions. The handler has already validated the change with the
// shared competitions schema. Each change is one database function that
// locks the event, so counts and positions stay right under parallel calls.
import type {
  CompetitionChange,
  UpdateCompetitionsRequest,
  UpdateCompetitionsResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Changes per user per event: a few taps in a row, not a loop. */
export const updateCompetitionsRateLimit: RateLimitRule = {
  key: "update_competitions",
  maxAttempts: 20,
  windowSeconds: 60,
};

/** What each refusal of the competition functions answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  too_many: { ok: false, error: "too_many" },
  invalid_name: { ok: false, error: "invalid_request" },
  mismatch: { ok: false, error: "invalid_request" },
  unknown: { ok: false, error: "not_found" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

/** The database function for the change, with its arguments and success code. */
function callFor(
  db: Db,
  eventId: string,
  change: CompetitionChange,
): { name: string; success: string; call: PromiseLike<RpcAnswer> } {
  switch (change.type) {
    case "add":
      return {
        name: "create_competition",
        success: "created",
        call: db.rpc("create_competition", {
          target_event_id: eventId,
          competition_name: change.name,
        }),
      };
    case "rename":
      return {
        name: "rename_competition",
        success: "renamed",
        call: db.rpc("rename_competition", {
          target_event_id: eventId,
          competition_id: change.id,
          competition_name: change.name,
        }),
      };
    case "remove":
      return {
        name: "delete_competition",
        success: "deleted",
        call: db.rpc("delete_competition", {
          target_event_id: eventId,
          competition_id: change.id,
        }),
      };
    case "reorder":
      return {
        name: "reorder_competitions",
        success: "reordered",
        call: db.rpc("reorder_competitions", {
          target_event_id: eventId,
          competition_ids: change.ids,
        }),
      };
  }
}

type RpcAnswer = {
  data: string | null;
  error: { code: string } | null;
};

export function updateCompetitions(
  db: Db,
  caller: string,
  request: UpdateCompetitionsRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    updateCompetitionsRateLimit,
    async (eventId) => {
      const { name, success, call } = callFor(db, eventId, request.change);
      const { data: outcome, error } = await call;
      if (error) return databaseFailed(name, error);
      if (outcome !== success) {
        return (
          refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" }
        );
      }

      const body: UpdateCompetitionsResponse = {};
      return { ok: true, body };
    },
  );
}
