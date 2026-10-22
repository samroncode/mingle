import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabase } from "./client";
import { parseTurnstileSiteKey } from "./env";
import { fail, ok, type Result } from "./errors";
import { getCaptchaToken } from "./turnstile";

export type AppClient = SupabaseClient<Database>;

/** Why there is no session: the CAPTCHA failed, or sign-in did. */
export type SessionErrorCode = "captcha_failed" | "sign_in_failed";

export type SessionResult = Result<string, SessionErrorCode>;

export interface SessionOptions {
  /** The Turnstile site key; defaults to the build's `VITE_TURNSTILE_SITE_KEY`. */
  siteKey?: string;
  /** Runs the CAPTCHA and returns its token; defaults to Cloudflare Turnstile. */
  getToken?: (siteKey: string) => Promise<string>;
}

/** Sign-ins in progress per client, so two callers share one CAPTCHA and one sign-in. */
const inFlight = new WeakMap<AppClient, Promise<SessionResult>>();

async function signIn(
  client: AppClient,
  options: SessionOptions,
): Promise<SessionResult> {
  const siteKey = options.siteKey ?? parseTurnstileSiteKey(import.meta.env);
  let captchaToken: string | undefined;
  if (siteKey) {
    try {
      captchaToken = await (options.getToken ?? getCaptchaToken)(siteKey);
    } catch {
      return fail("captcha_failed");
    }
  }
  const { data, error } = await client.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  );
  if (error?.code === "captcha_failed") return fail("captcha_failed");
  if (error || !data.user) return fail("sign_in_failed");
  return ok(data.user.id);
}

/**
 * The stored session, or nothing. Cleanup removes logins that sat unused for
 * 30 days, so a stored session may no longer refresh; it is then dropped from
 * this device and the caller signs in again.
 */
async function storedSession(client: AppClient) {
  const { data, error } = await client.auth.getSession();
  if (data.session && !error) return data.session;
  if (error) await client.auth.signOut({ scope: "local" });
  return null;
}

/**
 * Makes sure this browser has a Supabase session and returns its user id.
 * Signs in anonymously only when no session is stored, so the same device
 * keeps the same identity across calls and reloads. When a Turnstile site key
 * is set, the sign-in passes the CAPTCHA first; a device that already has a
 * session never does. A stored session whose login was deleted can't be
 * refreshed; a new anonymous login replaces it.
 */
export async function ensureAnonymousSession(
  client?: AppClient,
  options: SessionOptions = {},
): Promise<SessionResult> {
  try {
    client ??= getSupabase();
    const existing = await storedSession(client);
    if (existing) return ok(existing.user.id);

    const running = inFlight.get(client);
    if (running) return await running;
    const attempt = signIn(client, options);
    inFlight.set(client, attempt);
    try {
      return await attempt;
    } finally {
      inFlight.delete(client);
    }
  } catch {
    return fail("sign_in_failed");
  }
}
