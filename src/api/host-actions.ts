import { FunctionsHttpError } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  type ClaimHostRequest,
  type ClaimHostResponse,
  ClaimHostResponseSchema,
  type CreateEventRequest,
  type CreateEventResponse,
  CreateEventResponseSchema,
  type HostActionErrorCode,
  HostActionErrorSchema,
  type HostActionRequest,
  type RemoveGuestRequest,
  type RemoveGuestResponse,
  RemoveGuestResponseSchema,
  type RenameGuestRequest,
  type RenameGuestResponse,
  RenameGuestResponseSchema,
  type UpdateCostsRequest,
  type UpdateCostsResponse,
  UpdateCostsResponseSchema,
  type SetFlowRequest,
  type SetFlowResponse,
  SetFlowResponseSchema,
  type UpdatePartyContentRequest,
  type UpdatePartyContentResponse,
  UpdatePartyContentResponseSchema,
  type UpdateAwardsRequest,
  type UpdateAwardsResponse,
  UpdateAwardsResponseSchema,
  type UpdateHotTakesRequest,
  type UpdateHotTakesResponse,
  UpdateHotTakesResponseSchema,
  type UpdateQuizRequest,
  type UpdateQuizResponse,
  UpdateQuizResponseSchema,
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

/**
 * Makes the current session a host of the event, from the code and key in
 * the host link. A wrong key and an unknown code both fail with
 * `not_authorized`.
 */
export async function claimHost(
  input: Omit<ClaimHostRequest, "action">,
): Promise<HostActionResult<ClaimHostResponse>> {
  return toHostActionResult(
    ClaimHostResponseSchema,
    await invokeHostActions({ action: "claim_host", ...input }),
  );
}

/**
 * Moves the event's flow: start or stop an activity, next step, open, reveal
 * or end the event. Returns the flow after the move. A move the event's state
 * doesn't allow fails with `invalid_transition`, an activity the host turned
 * off with `module_disabled`.
 */
export async function setFlow(
  input: Omit<SetFlowRequest, "action">,
): Promise<HostActionResult<SetFlowResponse>> {
  return toHostActionResult(
    SetFlowResponseSchema,
    await invokeHostActions({ action: "set_flow", ...input }),
  );
}

/**
 * Replaces the event's party-screen content (welcome text, menu, schedule,
 * wifi, music link) as a whole: parts left out are removed. Members see it on
 * their next read. An ended event fails with `invalid_transition`.
 */
export async function updatePartyContent(
  input: Omit<UpdatePartyContentRequest, "action">,
): Promise<HostActionResult<UpdatePartyContentResponse>> {
  return toHostActionResult(
    UpdatePartyContentResponseSchema,
    await invokeHostActions({ action: "update_party_content", ...input }),
  );
}

/**
 * Replaces the quiz questions that aren't played yet with `questions`, in
 * order, after the played ones. Fails with `invalid_transition` while a
 * question is open or revealed, once the quiz is finished or the event has
 * ended; with `invalid_request` when played and new questions pass 30.
 */
export async function updateQuiz(
  input: Omit<UpdateQuizRequest, "action">,
): Promise<HostActionResult<UpdateQuizResponse>> {
  return toHostActionResult(
    UpdateQuizResponseSchema,
    await invokeHostActions({ action: "update_quiz", ...input }),
  );
}

/**
 * Replaces the award categories that aren't revealed yet with `categories`,
 * in order, after the revealed ones. Fails with `invalid_transition` while a
 * category is open or revealed, once every category is revealed or the event
 * has ended; with `invalid_request` when revealed and new categories pass 20.
 */
export async function updateAwards(
  input: Omit<UpdateAwardsRequest, "action">,
): Promise<HostActionResult<UpdateAwardsResponse>> {
  return toHostActionResult(
    UpdateAwardsResponseSchema,
    await invokeHostActions({ action: "update_awards", ...input }),
  );
}

/**
 * Replaces the hot takes that aren't revealed yet with `takes`, in order,
 * after the revealed ones. Fails with `invalid_transition` while a hot take
 * is open or revealed, once every hot take is revealed or the event has
 * ended; with `invalid_request` when revealed and new hot takes pass 20.
 */
export async function updateHotTakes(
  input: Omit<UpdateHotTakesRequest, "action">,
): Promise<HostActionResult<UpdateHotTakesResponse>> {
  return toHostActionResult(
    UpdateHotTakesResponseSchema,
    await invokeHostActions({ action: "update_hottakes", ...input }),
  );
}

/**
 * Gives a guest a new display name. Fails with `not_found` for a user who
 * isn't a guest of the event, `name_taken` when another guest has the name,
 * `invalid_name` when it isn't 1 to 30 characters, and `invalid_transition`
 * once the event has ended. The guest's answers and votes stay theirs.
 */
export async function renameGuest(
  input: Omit<RenameGuestRequest, "action">,
): Promise<HostActionResult<RenameGuestResponse>> {
  return toHostActionResult(
    RenameGuestResponseSchema,
    await invokeHostActions({ action: "rename_guest", ...input }),
  );
}

/**
 * Removes a guest from the evening, with their answers and votes on items
 * that aren't revealed yet. Fails with `not_found` for a user who isn't a
 * guest of the event or is already removed, and `invalid_transition` once the
 * event has ended.
 */
export async function removeGuest(
  input: Omit<RemoveGuestRequest, "action">,
): Promise<HostActionResult<RemoveGuestResponse>> {
  return toHostActionResult(
    RemoveGuestResponseSchema,
    await invokeHostActions({ action: "remove_guest", ...input }),
  );
}

/**
 * Replaces the event's shared costs as a whole (payee name, Swish number,
 * purchases with their sharers), or switches them off with `costs: null`,
 * which deletes the data. A purchase nobody shares, or a sharer who isn't a
 * current guest, fails with `invalid_sharer`.
 */
export async function updateCosts(
  input: Omit<UpdateCostsRequest, "action">,
): Promise<HostActionResult<UpdateCostsResponse>> {
  return toHostActionResult(
    UpdateCostsResponseSchema,
    await invokeHostActions({ action: "update_costs", ...input }),
  );
}
