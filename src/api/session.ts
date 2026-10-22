import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabase } from "./client";

export type AppClient = SupabaseClient<Database>;

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
 * keeps the same identity across calls and reloads. A stored session whose
 * login was deleted can't be refreshed; a new anonymous login replaces it.
 */
export async function ensureAnonymousSession(
  client: AppClient = getSupabase(),
): Promise<string> {
  const existing = await storedSession(client);
  if (existing) return existing.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw error ?? new Error("Anonymous sign-in returned no user.");
  }
  return data.user.id;
}

/** Like `ensureAnonymousSession`, but says false instead of throwing. */
export async function trySession(client?: AppClient): Promise<boolean> {
  try {
    await ensureAnonymousSession(client);
    return true;
  } catch {
    return false;
  }
}
