// rename_guest: the host gives a guest a new display name. The name rules
// (cleaning, length, unique among the guests) live in the database, which
// writes only when the user is a guest of this event, in one statement.
import type {
  RenameGuestRequest,
  RenameGuestResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Renames per user per event. */
export const renameGuestRateLimit: RateLimitRule = {
  key: "rename_guest",
  maxAttempts: 30,
  windowSeconds: 60,
};

/** What each refusal of rename_guest answers. */
const refusals: Record<string, ActionResult> = {
  ended: { ok: false, error: "invalid_transition" },
  name_taken: { ok: false, error: "name_taken" },
  invalid_name: { ok: false, error: "invalid_name" },
  not_found: { ok: false, error: "not_found" },
  // The event expired between the key check and the write.
  no_event: { ok: false, error: "not_authorized" },
};

export function renameGuest(
  db: Db,
  caller: string,
  request: RenameGuestRequest,
): Promise<ActionResult> {
  return asHost(db, caller, request, renameGuestRateLimit, async (eventId) => {
    const { data: outcome, error } = await db.rpc("rename_guest", {
      target_event_id: eventId,
      target_user_id: request.userId,
      new_name: request.name,
    });
    if (error) return databaseFailed("rename_guest", error);
    if (outcome !== "renamed") {
      return refusals[outcome] ?? { ok: false, error: "internal_error" };
    }

    const body: RenameGuestResponse = {};
    return { ok: true, body };
  });
}
