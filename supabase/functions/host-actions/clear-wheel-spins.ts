// clear_wheel_spins: the host clears the list of spins drawn this evening.
// The wheel's entries stay as they are.
import type {
  ClearWheelSpinsRequest,
  ClearWheelSpinsResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Clears per user per event: a few taps in a row, not a loop. */
export const clearWheelSpinsRateLimit: RateLimitRule = {
  key: "clear_wheel_spins",
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

export function clearWheelSpins(
  db: Db,
  caller: string,
  request: ClearWheelSpinsRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    clearWheelSpinsRateLimit,
    async (eventId) => {
      const { data: outcome, error } = await db.rpc("clear_wheel_spins", {
        target_event_id: eventId,
      });
      if (error) return databaseFailed("clear_wheel_spins", error);
      if (outcome !== "cleared") {
        return (
          refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" }
        );
      }

      const body: ClearWheelSpinsResponse = {};
      return { ok: true, body };
    },
  );
}
