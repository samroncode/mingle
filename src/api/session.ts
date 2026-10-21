import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabase } from "./client";

export type AppClient = SupabaseClient<Database>;

/**
 * Makes sure this browser has a Supabase session and returns its user id.
 * Signs in anonymously only when no session is stored, so the same device
 * keeps the same identity across calls and reloads.
 */
export async function ensureAnonymousSession(
  client: AppClient = getSupabase(),
): Promise<string> {
  const { data: existing } = await client.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw error ?? new Error("Anonymous sign-in returned no user.");
  }
  return data.user.id;
}
