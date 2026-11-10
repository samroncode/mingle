// set_wheel_auto_take_off: the host switches "take drawn entries off
// automatically" on or off. spin_wheel reads the setting from the event.
import type {
  SetWheelAutoTakeOffRequest,
  SetWheelAutoTakeOffResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Switches per user per event: a few taps in a row, not a loop. */
export const setWheelAutoTakeOffRateLimit: RateLimitRule = {
  key: "set_wheel_auto_take_off",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function setWheelAutoTakeOff(
  db: Db,
  caller: string,
  request: SetWheelAutoTakeOffRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    setWheelAutoTakeOffRateLimit,
    async (eventId) => {
      const { data: outcome, error } = await db.rpc("set_wheel_auto_take_off", {
        target_event_id: eventId,
        enabled: request.enabled,
      });
      if (error) return databaseFailed("set_wheel_auto_take_off", error);
      if (outcome !== "updated") {
        return (
          refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" }
        );
      }

      const body: SetWheelAutoTakeOffResponse = {};
      return { ok: true, body };
    },
  );
}
