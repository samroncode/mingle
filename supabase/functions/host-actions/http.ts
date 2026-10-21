// Responses. Every error is `{ "error": code }` with a code from the shared
// list, never free text (CLAUDE.md "Database rules").
import type { HostActionErrorCode } from "../../../src/lib/schemas/host-actions.ts";

const statusByError: Record<HostActionErrorCode, number> = {
  invalid_request: 400,
  not_authenticated: 401,
  not_authorized: 403,
  origin_not_allowed: 403,
  method_not_allowed: 405,
  payload_too_large: 413,
  rate_limited: 429,
  internal_error: 500,
};

/** What an action answers: its response body, or an error code. */
export type ActionResult =
  { ok: true; body: unknown } | { ok: false; error: HostActionErrorCode };

export function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errorResponse(
  error: HostActionErrorCode,
  headers: HeadersInit,
): Response {
  return jsonResponse(statusByError[error], { error }, headers);
}

export function resultResponse(
  result: ActionResult,
  headers: HeadersInit,
): Response {
  return result.ok
    ? jsonResponse(200, result.body, headers)
    : errorResponse(result.error, headers);
}
