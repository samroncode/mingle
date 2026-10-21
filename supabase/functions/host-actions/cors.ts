// CORS: only the origins in the ALLOWED_ORIGINS secret may call host-actions
// from a browser.

/** Parses the comma-separated ALLOWED_ORIGINS secret. Unset allows none. */
export function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ""),
  );
}

/**
 * The CORS headers for a request from `origin`, or null when that origin is
 * not allowed and the request must be refused. A request without an Origin
 * header doesn't come from a browser page, so CORS doesn't apply to it; it
 * still has to pass every other check.
 */
export function corsHeaders(
  origin: string | null,
  allowed: Set<string>,
): Record<string, string> | null {
  const headers = { Vary: "Origin" };
  if (origin === null) return headers;
  if (!allowed.has(origin)) return null;
  return {
    ...headers,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Max-Age": "3600",
  };
}
