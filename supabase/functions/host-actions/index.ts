// host-actions: every write a host makes goes through here (CLAUDE.md
// principle 2). The gateway's own JWT check is off for this function
// (supabase/config.toml), because it would refuse CORS preflights; the
// handler checks the caller's JWT itself.
import { parseAllowedOrigins } from "./cors.ts";
import { serviceClient } from "./db.ts";
import { createHandler } from "./handler.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const handler = createHandler({
  db: serviceClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
  ),
  allowedOrigins: parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS")),
});

Deno.serve(handler);
