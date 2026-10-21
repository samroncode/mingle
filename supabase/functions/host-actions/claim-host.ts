// claim_host: the host link opened on another device, or after the session
// was lost. With the right key, the caller's session becomes a host of the
// event (a co-host, if the event already has one).
import type {
  ClaimHostRequest,
  ClaimHostResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { asHost } from "./as-host.ts";
import type { Db } from "./db.ts";
import { type ActionResult, databaseFailed } from "./http.ts";

export function claimHost(
  db: Db,
  caller: string,
  request: ClaimHostRequest,
): Promise<ActionResult> {
  // Only the key check's own limit: claiming is rare and changes nothing
  // anyone else sees.
  return asHost(db, caller, request, null, async (eventId) => {
    const { data: claimed, error } = await db.rpc("claim_host", {
      caller,
      target_event_id: eventId,
    });
    if (error) return databaseFailed("claim_host", error);
    // The event expired between the key check and the claim.
    if (!claimed) return { ok: false, error: "not_authorized" };

    const body: ClaimHostResponse = {};
    return { ok: true, body };
  });
}
