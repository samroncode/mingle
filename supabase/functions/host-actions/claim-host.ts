// claim_host: the host link opened on another device, or after the session
// was lost. With the right key, the caller's session becomes a host of the
// event (a co-host, if the event already has one).
import type {
  ClaimHostRequest,
  ClaimHostResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import { authorizeHost } from "./admin-key.ts";
import type { Db } from "./db.ts";
import type { ActionResult } from "./http.ts";

export async function claimHost(
  db: Db,
  caller: string,
  request: ClaimHostRequest,
): Promise<ActionResult> {
  const auth = await authorizeHost(db, caller, request.code, request.key);
  if (!auth.ok) return auth;

  const { data: claimed, error } = await db.rpc("claim_host", {
    caller,
    target_event_id: auth.eventId,
  });
  if (error) {
    console.error("claim_host failed", error.code);
    return { ok: false, error: "internal_error" };
  }
  // The event expired between the key check and the claim.
  if (!claimed) return { ok: false, error: "not_authorized" };

  const body: ClaimHostResponse = {};
  return { ok: true, body };
}
