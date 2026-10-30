// set_modules: the host switches activities on and off. The handler has
// already checked that every id is a known activity and none repeats. The
// running activity can't be left out; a finished one can, and its results stay.
import type {
  SetModulesRequest,
  SetModulesResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Switches per user per event: a few taps in a row, not a loop. */
export const setModulesRateLimit: RateLimitRule = {
  key: "set_modules",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal of set_enabled_modules answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  running: { ok: false, error: "invalid_transition" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function setModules(
  db: Db,
  caller: string,
  request: SetModulesRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, setModulesRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("set_enabled_modules", {
      target_event_id: eventId,
      modules: request.modules,
    });
    if (error) return databaseFailed("set_enabled_modules", error);
    if (outcome !== "updated") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: SetModulesResponse = {};
    return { ok: true, body };
  });
}
