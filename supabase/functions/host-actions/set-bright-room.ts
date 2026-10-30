// set_bright_room: the host switches the light "day" theme on or off for a
// bright room. The TV and the guests' phones follow the event row.
import type {
  SetBrightRoomRequest,
  SetBrightRoomResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";

/** Switches per user per event: a few taps in a row, not a loop. */
export const setBrightRoomRateLimit: RateLimitRule = {
  key: "set_bright_room",
  maxAttempts: 10,
  windowSeconds: 60,
};

/** What each refusal of set_bright_room answers. */
const refusals: Record<string, ActionResult> = {
  // The event expired between the key check and the write.
  not_found: { ok: false, error: "not_authorized" },
};

export function setBrightRoom(
  db: Db,
  caller: string,
  request: SetBrightRoomRequest,
): Promise<ActionResult> {
  return asHost(
    db,
    caller,
    request,
    setBrightRoomRateLimit,
    async (eventId) => {
      const { data: outcome, error } = await db.rpc("set_bright_room", {
        target_event_id: eventId,
        bright: request.bright,
      });
      if (error) return databaseFailed("set_bright_room", error);
      if (outcome !== "updated") {
        return refusals[outcome] ?? { ok: false, error: "internal_error" };
      }

      const body: SetBrightRoomResponse = {};
      return { ok: true, body };
    },
  );
}
