// The service-role client. It bypasses RLS, so it exists only here, and its
// key is read only from the function environment.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/api/database.types.ts";

export type Db = SupabaseClient<Database>;

export function serviceClient(url: string, serviceRoleKey: string): Db {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
