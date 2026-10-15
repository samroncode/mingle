import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { parseSupabaseEnv } from "./env";

let client: SupabaseClient<Database> | undefined;

/**
 * The app's single Supabase client, only for use inside src/api/. It is
 * created on first use, so the app starts without .env, and missing settings
 * fail loudly the first time data is needed.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = parseSupabaseEnv(import.meta.env);
    client = createClient<Database>(url, publishableKey);
  }
  return client;
}
