// The admin key check every host action except create_event runs first:
// `authorizeHost` answers which event the code and key unlock, or why not.
//
// A wrong key, a key for another event, an unknown code and an expired event
// all answer the same `not_authorized`, so nobody without the key learns
// whether a code exists. Never log the key or its hash.
import type { Db } from "./db.ts";
import { consumeRateLimit, type RateLimitRule } from "./rate-limit.ts";
import { hashAdminKey } from "./secrets.ts";

/**
 * Failed key checks per user. Over the limit, every check answers
 * `rate_limited`, even with the right key, until the window has passed.
 * Parallel requests can each pass the limit check before any failure is
 * counted, so a burst may get a few extra guesses at a 256-bit key.
 */
export const adminKeyFailureRateLimit: RateLimitRule = {
  key: "admin_key_failure",
  maxAttempts: 10,
  windowSeconds: 10 * 60,
};

export type HostAuthorization =
  | { ok: true; eventId: string }
  | { ok: false; error: "not_authorized" | "rate_limited" };

/** Compared against when the code is unknown, so both paths do the same work. */
const NO_HASH = "0".repeat(64);

export async function authorizeHost(
  db: Db,
  caller: string,
  code: string,
  key: string,
): Promise<HostAuthorization> {
  if (await failureLimitReached(db, caller)) {
    return { ok: false, error: "rate_limited" };
  }

  const [received, stored] = await Promise.all([
    hashAdminKey(key),
    storedHash(db, code),
  ]);
  const matches = constantTimeEqual(received, stored?.hash ?? NO_HASH);
  if (stored !== null && matches) return { ok: true, eventId: stored.eventId };

  await consumeRateLimit(db, caller, adminKeyFailureRateLimit);
  return { ok: false, error: "not_authorized" };
}

async function failureLimitReached(db: Db, caller: string): Promise<boolean> {
  const { data, error } = await db.rpc("rate_limit_reached", {
    caller,
    action: adminKeyFailureRateLimit.key,
    max_attempts: adminKeyFailureRateLimit.maxAttempts,
    window_seconds: adminKeyFailureRateLimit.windowSeconds,
  });
  if (error) throw new Error(`rate_limit_reached failed: ${error.code}`);
  return data;
}

/** The event and its key hash, or null for an unknown or expired code. */
async function storedHash(
  db: Db,
  code: string,
): Promise<{ eventId: string; hash: string } | null> {
  const { data, error } = await db.rpc("event_admin_key_hash", { code });
  if (error) throw new Error(`event_admin_key_hash failed: ${error.code}`);
  const row = data[0];
  return row ? { eventId: row.event_id, hash: row.admin_key_hash } : null;
}

/**
 * Whether two strings are equal, taking the same time wherever they differ.
 * Both are 64-character hex hashes here; a length difference answers false.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return difference === 0;
}
