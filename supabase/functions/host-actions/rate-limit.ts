// Per-user rate limits, counted in private.rate_limits through
// public.consume_rate_limit (service role only).
import type { Db } from "./db.ts";

export type RateLimitRule = {
  /** The counter's name in private.rate_limits. */
  key: string;
  maxAttempts: number;
  windowSeconds: number;
};

/**
 * Counts one attempt and answers whether it's allowed. Throws when the
 * counter can't be reached, so a database fault never lifts the limit.
 */
export async function consumeRateLimit(
  db: Db,
  caller: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const { data, error } = await db.rpc("consume_rate_limit", {
    caller,
    action: rule.key,
    max_attempts: rule.maxAttempts,
    window_seconds: rule.windowSeconds,
  });
  if (error) throw new Error(`consume_rate_limit failed: ${error.code}`);
  return data;
}
