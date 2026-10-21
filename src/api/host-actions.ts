import { FunctionsHttpError } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  type CreateEventRequest,
  type CreateEventResponse,
  CreateEventResponseSchema,
  type HostActionErrorCode,
  HostActionErrorSchema,
  type HostActionRequest,
} from "@/lib/schemas/host-actions";
import { getSupabase } from "./client";

/**
 * What a host action can fail with: a code from host-actions, or
 * `network_error` when no answer came back. The UI maps each to an i18n key.
 */
export type HostActionError = HostActionErrorCode | "network_error";

export type HostActionResult<T> =
  { ok: true; data: T } | { ok: false; error: HostActionError };

/** How a call to host-actions ended, before its body is trusted. */
export type HostActionOutcome =
  | { kind: "success"; body: unknown }
  | { kind: "http_error"; body: unknown }
  | { kind: "network_error" };

/**
 * Turns a call's outcome into a typed result. Anything that isn't the
 * expected shape, such as a gateway error page, becomes `internal_error`.
 */
export function toHostActionResult<T>(
  schema: z.ZodType<T>,
  outcome: HostActionOutcome,
): HostActionResult<T> {
  if (outcome.kind === "network_error") {
    return { ok: false, error: "network_error" };
  }
  if (outcome.kind === "http_error") {
    const parsed = HostActionErrorSchema.safeParse(outcome.body);
    return {
      ok: false,
      error: parsed.success ? parsed.data.error : "internal_error",
    };
  }
  const parsed = schema.safeParse(outcome.body);
  return parsed.success
    ? { ok: true, data: parsed.data }
    : { ok: false, error: "internal_error" };
}

/** Calls host-actions with the current session (see ensureAnonymousSession). */
async function invokeHostActions(
  request: HostActionRequest,
): Promise<HostActionOutcome> {
  const result = await getSupabase().functions.invoke<unknown>("host-actions", {
    body: request,
  });
  // supabase-js types the error as `any`.
  const error: unknown = result.error;
  if (!error) return { kind: "success", body: result.data };
  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response;
    const body: unknown = await response.json().catch(() => undefined);
    return { kind: "http_error", body };
  }
  return { kind: "network_error" };
}

/**
 * Creates an event with the caller as its host. The admin key in the result
 * is returned this once and never again: put it in the host link right away.
 */
export async function createEvent(
  input: Omit<CreateEventRequest, "action">,
): Promise<HostActionResult<CreateEventResponse>> {
  return toHostActionResult(
    CreateEventResponseSchema,
    await invokeHostActions({ action: "create_event", ...input }),
  );
}
