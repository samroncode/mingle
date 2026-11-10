// update_wheel: the host puts guests on the Lucky wheel, adds an entry with
// their own text, takes one off the wheel, puts it back or deletes it. The
// handler has already validated the change with the shared wheel schemas.
// Each change is one database function that locks the event, so the count
// and the "only once" rule hold under parallel calls.
import type {
  UpdateWheelRequest,
  UpdateWheelResponse,
  WheelChange,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Changes per user per event: a few taps in a row, not a loop. */
export const updateWheelRateLimit: RateLimitRule = {
  key: "update_wheel",
  maxAttempts: 30,
  windowSeconds: 60,
};

/** What each refusal of the wheel functions answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  too_many: { ok: false, error: "too_many" },
  invalid_name: { ok: false, error: "invalid_name" },
  already_added: { ok: false, error: "already_added" },
  unknown: { ok: false, error: "not_found" },
  unknown_guest: { ok: false, error: "not_found" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

type RpcAnswer = {
  data: string | null;
  error: { code: string } | null;
};

/** The database function for the change, with its arguments and success code. */
function callFor(
  db: Db,
  eventId: string,
  change: WheelChange,
): { name: string; success: string; call: PromiseLike<RpcAnswer> } {
  switch (change.type) {
    case "add_guests":
      return {
        name: "add_wheel_guests",
        success: "added",
        call: db.rpc("add_wheel_guests", {
          target_event_id: eventId,
          guest_ids: change.ids,
        }),
      };
    case "add_custom":
      return {
        name: "add_wheel_custom",
        success: "added",
        call: db.rpc("add_wheel_custom", {
          target_event_id: eventId,
          entry_label: change.label,
        }),
      };
    case "take_off":
    case "put_back":
      return {
        name: "set_wheel_entry_state",
        success: "updated",
        call: db.rpc("set_wheel_entry_state", {
          target_event_id: eventId,
          entry_id: change.id,
          new_state: change.type === "take_off" ? "off" : "on",
        }),
      };
    case "remove":
      return {
        name: "delete_wheel_entry",
        success: "deleted",
        call: db.rpc("delete_wheel_entry", {
          target_event_id: eventId,
          entry_id: change.id,
        }),
      };
  }
}

export function updateWheel(
  db: Db,
  caller: string,
  request: UpdateWheelRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, updateWheelRateLimit, async (eventId) => {
    const { name, success, call } = callFor(db, eventId, request.change);
    const { data: outcome, error } = await call;
    if (error) return databaseFailed(name, error);
    if (outcome !== success) {
      return refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" };
    }

    const body: UpdateWheelResponse = {};
    return { ok: true, body };
  });
}
