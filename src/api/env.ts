import { z } from "zod";

const secretKeyMessage =
  "This is a secret key. Use the publishable (or legacy anon) key; secret keys must never reach the browser.";

/** True for a legacy Supabase JWT key whose role is `service_role`. */
function isServiceRoleJwt(key: string): boolean {
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const claims: unknown = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (
      typeof claims === "object" &&
      claims !== null &&
      "role" in claims &&
      claims.role === "service_role"
    );
  } catch {
    return false;
  }
}

const SupabaseEnvSchema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1)
    .refine((key) => !key.startsWith("sb_secret_"), secretKeyMessage)
    .refine((key) => !isServiceRoleJwt(key), secretKeyMessage),
});

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

/**
 * Validates the browser-safe Supabase settings, for example `import.meta.env`.
 * Throws an error that names each problem and points to .env.example.
 */
export function parseSupabaseEnv(env: Record<string, unknown>): SupabaseEnv {
  const result = SupabaseEnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(
      `Invalid Supabase settings (${problems}). Copy .env.example to .env and fill in the values.`,
    );
  }
  return {
    url: result.data.VITE_SUPABASE_URL,
    publishableKey: result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

/**
 * The public Cloudflare Turnstile site key, or undefined when none is set
 * (local, staging and tests), in which case sign-in asks for no CAPTCHA.
 */
export function parseTurnstileSiteKey(
  env: Record<string, unknown>,
): string | undefined {
  const key = env.VITE_TURNSTILE_SITE_KEY;
  return typeof key === "string" && key.trim() !== "" ? key.trim() : undefined;
}
