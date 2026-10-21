// The start every action on an existing event shares: the admin key check,
// then the action's own rate limit for that event, then the action.
import { authorizeHost } from "./admin-key.ts";
import type { Db } from "./db.ts";
import type { ActionResult } from "./http.ts";
import { consumeEventRateLimit, type RateLimitRule } from "./rate-limit.ts";

/** The code and admin key from the host link. */
export type HostLink = { code: string; key: string };

/**
 * Runs `action` for the event the host link unlocks. Without the right key it
 * answers what authorizeHost answers; over `rule`'s limit, `rate_limited`.
 * `rule` is null for an action that only has the key check's own limit.
 */
export async function asHost(
  db: Db,
  caller: string,
  link: HostLink,
  rule: RateLimitRule | null,
  action: (eventId: string) => Promise<ActionResult>,
): Promise<ActionResult> {
  const auth = await authorizeHost(db, caller, link.code, link.key);
  if (!auth.ok) return auth;
  if (
    rule !== null &&
    !(await consumeEventRateLimit(db, caller, auth.eventId, rule))
  ) {
    return { ok: false, error: "rate_limited" };
  }
  return action(auth.eventId);
}
