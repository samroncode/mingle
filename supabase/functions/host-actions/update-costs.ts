// update_costs: the host switches shared costs on, replacing the payee name,
// the Swish number and the purchases with their sharers, or off. The handler
// has already validated the body with the shared CostsSchema, which also
// normalises the Swish number. The database checks the sharers.
import type {
  UpdateCostsRequest,
  UpdateCostsResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Saves per user per event: a host adds a few purchases in a row. */
export const updateCostsRateLimit: RateLimitRule = {
  key: "update_costs",
  maxAttempts: 20,
  windowSeconds: 60,
};

/** What each refusal of update_costs answers. */
const refusals: Record<string, ActionResult> = {
  // A purchase nobody shares, or a sharer who isn't a current guest.
  bad_sharer: { ok: false, error: "invalid_sharer" },
  invalid: { ok: false, error: "invalid_request" },
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function updateCosts(
  db: Db,
  caller: string,
  request: UpdateCostsRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, updateCostsRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("update_costs", {
      target_event_id: eventId,
      costs: request.costs,
    });
    if (error) return databaseFailed("update_costs", error);
    if (outcome !== "updated") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: UpdateCostsResponse = {};
    return { ok: true, body };
  });
}
