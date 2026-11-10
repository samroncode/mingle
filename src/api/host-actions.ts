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
  type DeleteNoticeRequest,
  type DeleteNoticeResponse,
  DeleteNoticeResponseSchema,
  type RemoveGuestRequest,
  type RemoveGuestResponse,
  RemoveGuestResponseSchema,
  type RenameGuestRequest,
  type RenameGuestResponse,
  RenameGuestResponseSchema,
  type SendNoticeRequest,
  type SendNoticeResponse,
  SendNoticeResponseSchema,
  type SetBillSentRequest,
  type SetBrightRoomRequest,
  type SetBrightRoomResponse,
  SetBrightRoomResponseSchema,
  type SetModulesRequest,
  type SetModulesResponse,
  SetModulesResponseSchema,
  type SetPaymentRequest,
  type SetPaymentResponse,
  SetPaymentResponseSchema,
  type SetBillSentResponse,
  SetBillSentResponseSchema,
  type UpdateCompetitionsRequest,
  type UpdateCompetitionsResponse,
  UpdateCompetitionsResponseSchema,
  type UpdateWheelRequest,
  type UpdateWheelResponse,
  UpdateWheelResponseSchema,
  type UpdateMatchRequest,
  type UpdateMatchResponse,
  UpdateMatchResponseSchema,
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
 * off with `module_disabled`. Competitions starts with `competition` (the
 * position of the table to show, default the first); no competitions fail with
 * `module_empty`, a position that does not exist with `invalid_transition`.
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
 * Adds, renames, removes or reorders the event's competitions. Fails with
 * `module_disabled` while Competitions is switched off, `invalid_transition`
 * once the event has ended, `too_many` when an add would pass 5, `not_found`
 * for a competition that isn't the event's, and `invalid_request` for a name
 * that isn't 1 to 40 characters or a reorder that doesn't list every one.
 */
export async function updateCompetitions(
  input: Omit<UpdateCompetitionsRequest, "action">,
): Promise<HostActionResult<UpdateCompetitionsResponse>> {
  return toHostActionResult(
    UpdateCompetitionsResponseSchema,
    await invokeHostActions({ action: "update_competitions", ...input }),
  );
}

/**
 * Puts guests on the Lucky wheel, adds an entry with the host's own text,
 * takes one off the wheel or puts it back, or deletes one. Fails with
 * `module_disabled` while the wheel is switched off, `invalid_transition`
 * once the event has ended, `too_many` past 24 entries, `invalid_name` for
 * text that isn't 1 to 30 characters, `already_added` for a guest who is on
 * the wheel, and `not_found` for an entry or guest that isn't the event's.
 */
export async function updateWheel(
  input: Omit<UpdateWheelRequest, "action">,
): Promise<HostActionResult<UpdateWheelResponse>> {
  return toHostActionResult(
    UpdateWheelResponseSchema,
    await invokeHostActions({ action: "update_wheel", ...input }),
  );
}

/**
 * Fixes the winner or score of a reported match, or deletes it. Fails with
 * `not_found` for a match that isn't the event's, `module_disabled` while
 * Competitions is switched off, `invalid_transition` once the event has
 * ended, and `invalid_request` for a winner who didn't play the match or a
 * score that doesn't agree with the winner.
 */
export async function updateMatch(
  input: Omit<UpdateMatchRequest, "action">,
): Promise<HostActionResult<UpdateMatchResponse>> {
  return toHostActionResult(
    UpdateMatchResponseSchema,
    await invokeHostActions({ action: "update_match", ...input }),
  );
}

/**
 * Saves which activities are switched on, in display order. Fails with
 * `invalid_transition` when the list leaves out the running activity or the
 * event has ended, and `invalid_request` for an unknown or repeated id.
 */
export async function setModules(
  input: Omit<SetModulesRequest, "action">,
): Promise<HostActionResult<SetModulesResponse>> {
  return toHostActionResult(
    SetModulesResponseSchema,
    await invokeHostActions({ action: "set_modules", ...input }),
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

/**
 * Sends the bill to the guests (`sent: true`) or hides it again. Fails with
 * `invalid_transition` while shared costs are switched off.
 */
export async function setBillSent(
  input: Omit<SetBillSentRequest, "action">,
): Promise<HostActionResult<SetBillSentResponse>> {
  return toHostActionResult(
    SetBillSentResponseSchema,
    await invokeHostActions({ action: "set_bill_sent", ...input }),
  );
}

/**
 * Confirms a guest's payment, which stores their current total (also to mark
 * a guest paid directly), or undoes it (`change: "undo"`). Fails with
 * `not_found` for a user who isn't a current guest, and `invalid_transition`
 * while shared costs are switched off.
 */
export async function setPayment(
  input: Omit<SetPaymentRequest, "action">,
): Promise<HostActionResult<SetPaymentResponse>> {
  return toHostActionResult(
    SetPaymentResponseSchema,
    await invokeHostActions({ action: "set_payment", ...input }),
  );
}

/** Switches the light "day" theme on or off for the TV and the guests' phones. */
export async function setBrightRoom(
  input: Omit<SetBrightRoomRequest, "action">,
): Promise<HostActionResult<SetBrightRoomResponse>> {
  return toHostActionResult(
    SetBrightRoomResponseSchema,
    await invokeHostActions({ action: "set_bright_room", ...input }),
  );
}

/**
 * Sends a notice (1 to 140 characters, plain text) to every guest's phone.
 * Fails with `ended` once the event has ended, `too_many` past 30 notices and
 * `too_soon` within 5 seconds of the last one.
 */
export async function sendNotice(
  input: Omit<SendNoticeRequest, "action">,
): Promise<HostActionResult<SendNoticeResponse>> {
  return toHostActionResult(
    SendNoticeResponseSchema,
    await invokeHostActions({ action: "send_notice", ...input }),
  );
}

/** Deletes a notice. Fails with `not_found` for an unknown notice. */
export async function deleteNotice(
  input: Omit<DeleteNoticeRequest, "action">,
): Promise<HostActionResult<DeleteNoticeResponse>> {
  return toHostActionResult(
    DeleteNoticeResponseSchema,
    await invokeHostActions({ action: "delete_notice", ...input }),
  );
}
