// spin_wheel: the host spins the Lucky wheel. The database draws the winner
// (uniformly, server side), stores the spin and, when the event's setting is
// on, takes the winner off the wheel in the same transaction.
import type {
  SpinWheelRequest,
  SpinWheelResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Spins per user per event: a spin takes seconds on the TV, so a stuck button can't flood. */
export const spinWheelRateLimit: RateLimitRule = {
  key: "spin_wheel",
  maxAttempts: 20,
  windowSeconds: 60,
};

/** What each refusal of spin_wheel answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  not_running: { ok: false, error: "invalid_transition" },
  disabled: { ok: false, error: "module_disabled" },
  not_enough_entries: { ok: false, error: "not_enough_entries" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function spinWheel(
  db: Db,
  caller: string,
  request: SpinWheelRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, spinWheelRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("spin_wheel", {
      target_event_id: eventId,
    });
    if (error) return databaseFailed("spin_wheel", error);
    if (outcome !== "spun") {
      return refusals[outcome ?? ""] ?? { ok: false, error: "internal_error" };
    }

    const body: SpinWheelResponse = {};
    return { ok: true, body };
  });
}
