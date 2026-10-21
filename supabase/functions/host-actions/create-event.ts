// create_event: the wizard's data in, `{ code, key }` out. The caller becomes
// the event's host. This is the only response that ever contains the key.
import type {
  CreateEventRequest,
  CreateEventResponse,
} from "../../../src/lib/schemas/host-actions.ts";
import type { Db } from "./db.ts";
import type { ActionResult } from "./http.ts";
import type { RateLimitRule } from "./rate-limit.ts";
import {
  generateAdminKey,
  generateEventCode,
  hashAdminKey,
} from "./secrets.ts";

/** A few events per user per hour. */
export const createEventRateLimit: RateLimitRule = {
  key: "create_event",
  maxAttempts: 5,
  windowSeconds: 60 * 60,
};

/** Tries this many fresh codes before giving up on a clash. */
const CODE_ATTEMPTS = 5;

export async function createEvent(
  db: Db,
  caller: string,
  request: CreateEventRequest,
): Promise<ActionResult> {
  const key = generateAdminKey();
  const adminKeyHash = await hashAdminKey(key);

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const code = generateEventCode();
    const { data: eventId, error } = await db.rpc("create_event", {
      caller,
      code,
      niche: request.niche,
      language: request.language,
      enabled_modules: request.enabledModules,
      party: request.party,
      admin_key_hash: adminKeyHash,
    });
    if (error) {
      console.error("create_event failed", error.code);
      return { ok: false, error: "internal_error" };
    }
    if (eventId !== null) {
      const body: CreateEventResponse = { code, key };
      return { ok: true, body };
    }
  }

  console.error("create_event found no free code");
  return { ok: false, error: "internal_error" };
}
