// The host-actions request and response contract, shared by the app and the
// Edge Function. The function imports this file by relative path under Deno:
// only `zod` and relative imports with a `.ts` extension, and no browser or
// Node APIs. Later actions add their schema to `HostActionRequestSchema`.
import { z } from "zod";
import { supportedLanguages } from "../../i18n/language.ts";
import { moduleIds } from "../../modules/registry.ts";
import { nicheIds } from "../../niches/ids.ts";
import { ADMIN_KEY_PATTERN, EVENT_CODE_PATTERN } from "../formats.ts";
import { AwardCategoriesSchema } from "./awards.ts";
import {
  CompetitionNameSchema,
  competitionsLimits,
  CompetitionsSchema,
} from "./competitions.ts";
import { CostsSchema, WizardCostsSchema } from "./costs.ts";
import { HotTakesSchema } from "./hottakes.ts";
import { PartySchema } from "./party.ts";
import { QuizQuestionsSchema } from "./quiz.ts";
import { WheelGuestIdsSchema, WheelLabelSchema } from "./wheel.ts";

/** 6 characters without look-alikes (no 0/O, no 1/I/L), as in the database. */
export const EventCodeSchema = z.string().regex(EVENT_CODE_PATTERN);

/** 32 random bytes, base64url-encoded without padding. */
export const AdminKeySchema = z.string().regex(ADMIN_KEY_PATTERN);

export const ModuleIdSchema = z.enum(moduleIds);

export const CreateEventRequestSchema = z
  .strictObject({
    action: z.literal("create_event"),
    niche: z.enum(nicheIds),
    language: z.enum(supportedLanguages),
    /** The activities the host kept switched on. May be empty. */
    enabledModules: z
      .array(ModuleIdSchema)
      .refine((ids) => new Set(ids).size === ids.length, "duplicate module"),
    party: PartySchema,
    /** The quiz questions picked in the wizard, in order. Needs the quiz on. */
    quiz: QuizQuestionsSchema.optional(),
    /** The award categories picked in the wizard, in order. Needs awards on. */
    awards: AwardCategoriesSchema.optional(),
    /** The hot takes picked in the wizard, in order. Needs hot takes on. */
    hottakes: HotTakesSchema.optional(),
    /** The competitions picked in the wizard, in order. Needs Competitions on. */
    competitions: CompetitionsSchema.optional(),
    /**
     * Shared costs switched on in the wizard: the payee, the Swish number and
     * the purchases, which have no sharers yet. Left out when switched off.
     */
    costs: WizardCostsSchema.optional(),
  })
  .refine(
    (request) =>
      !request.quiz?.length || request.enabledModules.includes("quiz"),
    { path: ["quiz"], message: "quiz questions need the quiz switched on" },
  )
  .refine(
    (request) =>
      !request.awards?.length || request.enabledModules.includes("awards"),
    { path: ["awards"], message: "award categories need awards switched on" },
  )
  .refine(
    (request) =>
      !request.hottakes?.length || request.enabledModules.includes("hottakes"),
    { path: ["hottakes"], message: "hot takes need hot takes switched on" },
  )
  .refine(
    (request) =>
      !request.competitions?.length ||
      request.enabledModules.includes("competitions"),
    {
      path: ["competitions"],
      message: "competitions need Competitions switched on",
    },
  );

export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;

/** The only response that ever contains the admin key. */
export const CreateEventResponseSchema = z.strictObject({
  code: EventCodeSchema,
  key: AdminKeySchema,
});

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;

/**
 * The fields every action except `create_event` carries: the event's code and
 * admin key from the host link. Spread into each action's schema.
 */
export const hostLinkFields = {
  code: EventCodeSchema,
  key: AdminKeySchema,
};

/** Makes the caller's session a host of the event (a new device, a lost session). */
export const ClaimHostRequestSchema = z.strictObject({
  action: z.literal("claim_host"),
  ...hostLinkFields,
});

export type ClaimHostRequest = z.infer<typeof ClaimHostRequestSchema>;

/** Empty: the caller can now read the event as its host. */
export const ClaimHostResponseSchema = z.strictObject({});

export type ClaimHostResponse = z.infer<typeof ClaimHostResponseSchema>;

/**
 * The moves a host makes in the event's flow. Which move is allowed in which
 * state is decided by the flow state machine in host-actions (`flow.ts`).
 */
export const FlowMoveSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("start_module"),
    module: ModuleIdSchema,
    /**
     * Competitions only: the position of the competition whose table goes on
     * the TV (from 0). Left out, the first one.
     */
    competition: z.number().int().min(0).max(4).optional(),
  }),
  z.strictObject({ type: z.literal("stop_module") }),
  z.strictObject({ type: z.literal("next_step") }),
  z.strictObject({ type: z.literal("open") }),
  z.strictObject({ type: z.literal("reveal") }),
  z.strictObject({ type: z.literal("end_event") }),
]);

export type FlowMove = z.infer<typeof FlowMoveSchema>;

/** Moves the event's flow: start or stop an activity, next step, open, reveal, end. */
export const SetFlowRequestSchema = z.strictObject({
  action: z.literal("set_flow"),
  ...hostLinkFields,
  move: FlowMoveSchema,
});

export type SetFlowRequest = z.infer<typeof SetFlowRequestSchema>;

/** The event's flow (CLAUDE.md principle 1), as stored in `events`. */
export const FlowStateSchema = z.strictObject({
  status: z.enum(["lobby", "live", "ended"]),
  currentModule: ModuleIdSchema.nullable(),
  currentStep: z.number().int().nonnegative(),
  phase: z.enum(["idle", "open", "revealed"]),
});

export type FlowState = z.infer<typeof FlowStateSchema>;

/** The event's flow after the move. */
export const SetFlowResponseSchema = FlowStateSchema;

export type SetFlowResponse = z.infer<typeof SetFlowResponseSchema>;

/**
 * Replaces the event's party-screen content (welcome text, menu, schedule,
 * wifi, music link) as a whole, validated like `create_event`'s `party`.
 */
export const UpdatePartyContentRequestSchema = z.strictObject({
  action: z.literal("update_party_content"),
  ...hostLinkFields,
  party: PartySchema,
});

export type UpdatePartyContentRequest = z.infer<
  typeof UpdatePartyContentRequestSchema
>;

/** Empty: members read the new content on their next read. */
export const UpdatePartyContentResponseSchema = z.strictObject({});

export type UpdatePartyContentResponse = z.infer<
  typeof UpdatePartyContentResponseSchema
>;

/**
 * Replaces the quiz questions that aren't played yet with `questions`, in
 * order, after the played ones. Played and new questions together stay
 * within the quiz's limit of 30.
 */
export const UpdateQuizRequestSchema = z.strictObject({
  action: z.literal("update_quiz"),
  ...hostLinkFields,
  questions: QuizQuestionsSchema,
});

export type UpdateQuizRequest = z.infer<typeof UpdateQuizRequestSchema>;

/** Empty: the host and members read the new questions on their next read. */
export const UpdateQuizResponseSchema = z.strictObject({});

export type UpdateQuizResponse = z.infer<typeof UpdateQuizResponseSchema>;

/**
 * Replaces the award categories that aren't revealed yet with `categories`,
 * in order, after the revealed ones. Revealed and new categories together
 * stay within the awards' limit of 20.
 */
export const UpdateAwardsRequestSchema = z.strictObject({
  action: z.literal("update_awards"),
  ...hostLinkFields,
  categories: AwardCategoriesSchema,
});

export type UpdateAwardsRequest = z.infer<typeof UpdateAwardsRequestSchema>;

/** Empty: the host and members read the new categories on their next read. */
export const UpdateAwardsResponseSchema = z.strictObject({});

export type UpdateAwardsResponse = z.infer<typeof UpdateAwardsResponseSchema>;

/**
 * Replaces the hot takes that aren't revealed yet with `takes`, in order,
 * after the revealed ones. Revealed and new hot takes together stay within
 * the limit of 20.
 */
export const UpdateHotTakesRequestSchema = z.strictObject({
  action: z.literal("update_hottakes"),
  ...hostLinkFields,
  takes: HotTakesSchema,
});

export type UpdateHotTakesRequest = z.infer<typeof UpdateHotTakesRequestSchema>;

/** Empty: the host and members read the new hot takes on their next read. */
export const UpdateHotTakesResponseSchema = z.strictObject({});

export type UpdateHotTakesResponse = z.infer<
  typeof UpdateHotTakesResponseSchema
>;

/**
 * One change to the event's competitions: add one last in the list, rename
 * one, remove one (the ones after it move up) or put them in a new order.
 * `ids` of a reorder lists every competition of the event exactly once.
 */
export const CompetitionChangeSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("add"), name: CompetitionNameSchema }),
  z.strictObject({
    type: z.literal("rename"),
    id: z.uuid(),
    name: CompetitionNameSchema,
  }),
  z.strictObject({ type: z.literal("remove"), id: z.uuid() }),
  z.strictObject({
    type: z.literal("reorder"),
    ids: z.array(z.uuid()).max(competitionsLimits.perEvent),
  }),
]);

export type CompetitionChange = z.infer<typeof CompetitionChangeSchema>;

/**
 * Changes the event's competitions. Fails with `module_disabled` while
 * Competitions is switched off, `invalid_transition` once the event has ended,
 * `too_many` when an add would pass 5, and `not_found` for a competition that
 * isn't the event's.
 */
export const UpdateCompetitionsRequestSchema = z.strictObject({
  action: z.literal("update_competitions"),
  ...hostLinkFields,
  change: CompetitionChangeSchema,
});

export type UpdateCompetitionsRequest = z.infer<
  typeof UpdateCompetitionsRequestSchema
>;

/** Empty: the host and members read the new list on their next read. */
export const UpdateCompetitionsResponseSchema = z.strictObject({});

export type UpdateCompetitionsResponse = z.infer<
  typeof UpdateCompetitionsResponseSchema
>;

/**
 * One change to the Lucky wheel's entries: put several guests on it, add an
 * entry with the host's own text, take one off the wheel (the row stays),
 * put one back, or delete one for good.
 */
export const WheelChangeSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("add_guests"), ids: WheelGuestIdsSchema }),
  z.strictObject({ type: z.literal("add_custom"), label: WheelLabelSchema }),
  z.strictObject({ type: z.literal("take_off"), id: z.uuid() }),
  z.strictObject({ type: z.literal("put_back"), id: z.uuid() }),
  z.strictObject({ type: z.literal("remove"), id: z.uuid() }),
]);

export type WheelChange = z.infer<typeof WheelChangeSchema>;

/**
 * Changes the Lucky wheel's entries. Fails with `module_disabled` while the
 * wheel is switched off, `invalid_transition` once the event has ended,
 * `too_many` past 24 entries, `invalid_name` for custom text that isn't 1 to
 * 30 characters, `already_added` for a guest who is on the wheel, and
 * `not_found` for an entry that isn't the event's or a guest who isn't a
 * current guest of it.
 */
export const UpdateWheelRequestSchema = z.strictObject({
  action: z.literal("update_wheel"),
  ...hostLinkFields,
  change: WheelChangeSchema,
});

export type UpdateWheelRequest = z.infer<typeof UpdateWheelRequestSchema>;

/** Empty: the host and members read the new list on their next read. */
export const UpdateWheelResponseSchema = z.strictObject({});

export type UpdateWheelResponse = z.infer<typeof UpdateWheelResponseSchema>;

/**
 * Spins the Lucky wheel: the server draws one entry at random among those on
 * the wheel and stores the spin. Fails with `not_enough_entries` when fewer
 * than two entries are on the wheel, `invalid_transition` when the wheel is
 * not the running activity or the event has ended, `module_disabled` while
 * the wheel is switched off, and `rate_limited` on a flood of spins.
 */
export const SpinWheelRequestSchema = z.strictObject({
  action: z.literal("spin_wheel"),
  ...hostLinkFields,
});

export type SpinWheelRequest = z.infer<typeof SpinWheelRequestSchema>;

/** Empty: the host and members read the new spin on their next read. */
export const SpinWheelResponseSchema = z.strictObject({});

export type SpinWheelResponse = z.infer<typeof SpinWheelResponseSchema>;

/**
 * Switches "take drawn entries off automatically" on or off. It can change
 * while the wheel runs. Fails with `module_disabled` while the wheel is
 * switched off and `invalid_transition` once the event has ended.
 */
export const SetWheelAutoTakeOffRequestSchema = z.strictObject({
  action: z.literal("set_wheel_auto_take_off"),
  ...hostLinkFields,
  enabled: z.boolean(),
});

export type SetWheelAutoTakeOffRequest = z.infer<
  typeof SetWheelAutoTakeOffRequestSchema
>;

/** Empty: the host and the screens read the new setting from the event. */
export const SetWheelAutoTakeOffResponseSchema = z.strictObject({});

export type SetWheelAutoTakeOffResponse = z.infer<
  typeof SetWheelAutoTakeOffResponseSchema
>;

/**
 * Clears the list of spins drawn this evening. The entries stay as they are.
 * Fails with `module_disabled` while the wheel is switched off and
 * `invalid_transition` once the event has ended.
 */
export const ClearWheelSpinsRequestSchema = z.strictObject({
  action: z.literal("clear_wheel_spins"),
  ...hostLinkFields,
});

export type ClearWheelSpinsRequest = z.infer<
  typeof ClearWheelSpinsRequestSchema
>;

/** Empty: the host and members read the empty list on their next read. */
export const ClearWheelSpinsResponseSchema = z.strictObject({});

export type ClearWheelSpinsResponse = z.infer<
  typeof ClearWheelSpinsResponseSchema
>;

/** A match's score: whole numbers from 0 to 999, the winner's the higher. */
const MatchScoreSchema = z.strictObject({
  winner: z.number().int().min(0).max(999),
  loser: z.number().int().min(0).max(999),
});

/**
 * One fix to a reported match. An edit names the winner (one of the match's
 * two players, so naming the other swaps them) and the score, or no score to
 * clear it. The database checks the rest.
 */
export const MatchChangeSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("edit"),
    id: z.uuid(),
    winnerId: z.uuid(),
    score: MatchScoreSchema.optional(),
  }),
  z.strictObject({ type: z.literal("delete"), id: z.uuid() }),
]);

export type MatchChange = z.infer<typeof MatchChangeSchema>;

/**
 * Fixes or deletes a match reported in the event. Fails with `not_found` for
 * a match that isn't the event's, `module_disabled` while Competitions is
 * switched off, `invalid_transition` once the event has ended, and
 * `invalid_request` for a winner who didn't play the match or a score that
 * doesn't agree with the winner.
 */
export const UpdateMatchRequestSchema = z.strictObject({
  action: z.literal("update_match"),
  ...hostLinkFields,
  change: MatchChangeSchema,
});

export type UpdateMatchRequest = z.infer<typeof UpdateMatchRequestSchema>;

/** Empty: the host and members read the matches again. */
export const UpdateMatchResponseSchema = z.strictObject({});

export type UpdateMatchResponse = z.infer<typeof UpdateMatchResponseSchema>;

/**
 * Gives a guest of the event a new display name. The name is cleaned and
 * checked by the database (1 to 30 characters, unique among the guests), the
 * same rules as when joining; the guest's answers and votes stay theirs.
 */
export const RenameGuestRequestSchema = z.strictObject({
  action: z.literal("rename_guest"),
  ...hostLinkFields,
  userId: z.uuid(),
  /** Long names reach the database, which answers invalid_name. */
  name: z.string().max(200),
});

export type RenameGuestRequest = z.infer<typeof RenameGuestRequestSchema>;

/** Empty: the guest's phone and the TV read the new name from the members. */
export const RenameGuestResponseSchema = z.strictObject({});

export type RenameGuestResponse = z.infer<typeof RenameGuestResponseSchema>;

/**
 * Removes a guest from the evening. The guest's answers and votes on items
 * that aren't revealed yet go with them; a removed phone can't join again.
 */
export const RemoveGuestRequestSchema = z.strictObject({
  action: z.literal("remove_guest"),
  ...hostLinkFields,
  userId: z.uuid(),
});

export type RemoveGuestRequest = z.infer<typeof RemoveGuestRequestSchema>;

/** Empty: the TV and the host read the new member list. */
export const RemoveGuestResponseSchema = z.strictObject({});

export type RemoveGuestResponse = z.infer<typeof RemoveGuestResponseSchema>;

/**
 * Replaces the event's shared costs as a whole: the payee name, the Swish
 * number and the purchases with their sharers. `null` switches shared costs
 * off and deletes the data. Only the host ever reads it back.
 */
export const UpdateCostsRequestSchema = z.strictObject({
  action: z.literal("update_costs"),
  ...hostLinkFields,
  costs: CostsSchema.nullable(),
});

export type UpdateCostsRequest = z.infer<typeof UpdateCostsRequestSchema>;

/** Empty: the host reads the new costs on their next read. */
export const UpdateCostsResponseSchema = z.strictObject({});

export type UpdateCostsResponse = z.infer<typeof UpdateCostsResponseSchema>;

/**
 * Sends the bill to the guests, or hides it again. Until it is sent, guests
 * see nothing about money. Fails with `invalid_transition` while shared costs
 * are switched off.
 */
export const SetBillSentRequestSchema = z.strictObject({
  action: z.literal("set_bill_sent"),
  ...hostLinkFields,
  sent: z.boolean(),
});

export type SetBillSentRequest = z.infer<typeof SetBillSentRequestSchema>;

/** Empty: the host reads the new state, guests' phones follow `costs_version`. */
export const SetBillSentResponseSchema = z.strictObject({});

export type SetBillSentResponse = z.infer<typeof SetBillSentResponseSchema>;

/**
 * Settles a guest's share: `confirm` stores their current total as paid (an
 * "I've paid" the host has seen in Swish, or cash), `undo` takes a
 * confirmation back and clears "I've paid". Fails with `not_found` for a
 * user who isn't a current guest, and `invalid_transition` while shared
 * costs are switched off.
 */
export const SetPaymentRequestSchema = z.strictObject({
  action: z.literal("set_payment"),
  ...hostLinkFields,
  userId: z.uuid(),
  change: z.enum(["confirm", "undo"]),
});

export type SetPaymentRequest = z.infer<typeof SetPaymentRequestSchema>;

/** Empty: the host reads the new payments, the guest's phone follows `costs_version`. */
export const SetPaymentResponseSchema = z.strictObject({});

export type SetPaymentResponse = z.infer<typeof SetPaymentResponseSchema>;

/**
 * Replaces the event's enabled activities with `modules`, in the order the
 * panel shows them. Fails with `invalid_transition` when the list leaves out
 * the running activity or the event has ended.
 */
export const SetModulesRequestSchema = z.strictObject({
  action: z.literal("set_modules"),
  ...hostLinkFields,
  modules: z
    .array(ModuleIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate module"),
});

export type SetModulesRequest = z.infer<typeof SetModulesRequestSchema>;

/** Empty: the host and members read the new list from the event row. */
export const SetModulesResponseSchema = z.strictObject({});

export type SetModulesResponse = z.infer<typeof SetModulesResponseSchema>;

/**
 * Switches the light "day" theme on (`bright: true`) or off for the event. The
 * TV and the guests' phones follow the event row.
 */
export const SetBrightRoomRequestSchema = z.strictObject({
  action: z.literal("set_bright_room"),
  ...hostLinkFields,
  bright: z.boolean(),
});

export type SetBrightRoomRequest = z.infer<typeof SetBrightRoomRequestSchema>;

/** Empty: the host and the screens read the new state from the event. */
export const SetBrightRoomResponseSchema = z.strictObject({});

export type SetBrightRoomResponse = z.infer<typeof SetBrightRoomResponseSchema>;

/**
 * Sends a short text to every guest's phone. The text is trimmed and must be
 * 1 to 140 characters; it is shown as plain text. The database holds the
 * limits: `too_many` past 30 notices, `too_soon` within 5 seconds of the
 * last one, and `ended` once the event has ended.
 */
export const SendNoticeRequestSchema = z.strictObject({
  action: z.literal("send_notice"),
  ...hostLinkFields,
  text: z.string().trim().min(1).max(140),
});

export type SendNoticeRequest = z.infer<typeof SendNoticeRequestSchema>;

/** Empty: the host and the phones read the notices again on `notices_version`. */
export const SendNoticeResponseSchema = z.strictObject({});

export type SendNoticeResponse = z.infer<typeof SendNoticeResponseSchema>;

/**
 * Deletes a notice the host sent. Fails with `not_found` for an unknown
 * notice and for one that belongs to another event.
 */
export const DeleteNoticeRequestSchema = z.strictObject({
  action: z.literal("delete_notice"),
  ...hostLinkFields,
  id: z.uuid(),
});

export type DeleteNoticeRequest = z.infer<typeof DeleteNoticeRequestSchema>;

/** Empty: the host and the phones read the notices again on `notices_version`. */
export const DeleteNoticeResponseSchema = z.strictObject({});

export type DeleteNoticeResponse = z.infer<typeof DeleteNoticeResponseSchema>;

/** Every body host-actions accepts, told apart by `action`. */
export const HostActionRequestSchema = z.discriminatedUnion("action", [
  CreateEventRequestSchema,
  ClaimHostRequestSchema,
  SetFlowRequestSchema,
  UpdatePartyContentRequestSchema,
  UpdateQuizRequestSchema,
  UpdateAwardsRequestSchema,
  UpdateHotTakesRequestSchema,
  UpdateCompetitionsRequestSchema,
  UpdateWheelRequestSchema,
  SpinWheelRequestSchema,
  SetWheelAutoTakeOffRequestSchema,
  ClearWheelSpinsRequestSchema,
  UpdateMatchRequestSchema,
  RenameGuestRequestSchema,
  RemoveGuestRequestSchema,
  UpdateCostsRequestSchema,
  SetBillSentRequestSchema,
  SetPaymentRequestSchema,
  SetModulesRequestSchema,
  SetBrightRoomRequestSchema,
  SendNoticeRequestSchema,
  DeleteNoticeRequestSchema,
]);

export type HostActionRequest = z.infer<typeof HostActionRequestSchema>;
export type HostActionName = HostActionRequest["action"];

/**
 * Every error host-actions answers with, as `{ "error": code }`. Never free
 * text: the app maps each code to an i18n key.
 */
export const hostActionErrorCodes = [
  "invalid_request",
  "not_authenticated",
  /** A wrong key, a key for another event, or an unknown or expired code. */
  "not_authorized",
  "origin_not_allowed",
  "method_not_allowed",
  "payload_too_large",
  "rate_limited",
  /**
   * A flow move the event's state doesn't allow, including any move after it
   * ended, any change to the party content of an ended event, and a quiz
   * edit while a question is open or revealed, once the quiz is finished or
   * once the event has ended; and the same for an awards or hot takes edit.
   * Also renaming or removing a guest once the event has ended, and
   * set_bill_sent or set_payment while shared costs are switched off, and
   * spin_wheel while the wheel is not the running activity.
   */
  "invalid_transition",
  /** start_module for an activity the host turned off, spin_wheel or a wheel setting while the wheel is off, quiz questions, award categories, hot takes or competitions for it. */
  "module_disabled",
  /** start_module for an activity with no steps, such as a quiz without questions. */
  "module_empty",
  /** start_module for an activity whose steps have all been played. */
  "module_finished",
  /** rename_guest, remove_guest or set_payment for a user who isn't a guest of the event (or is already removed), delete_notice for an unknown notice or another event's, update_competitions for a competition that isn't the event's, update_wheel for an entry that isn't the event's or a guest who isn't a current guest of it, update_match for a match that isn't the event's. */
  "not_found",
  /** rename_guest to a name another guest of the event has. */
  "name_taken",
  /** rename_guest to a name that isn't 1 to 30 characters once cleaned, update_wheel with custom text that isn't. */
  "invalid_name",
  /** send_notice once the event has ended. */
  "ended",
  /** send_notice when the event already has 30 notices, an add of a sixth competition, an add that would put more than 24 entries on the wheel. */
  "too_many",
  /** update_wheel to put a guest on the wheel who already is on it. */
  "already_added",
  /** spin_wheel with fewer than two entries on the wheel. */
  "not_enough_entries",
  /** send_notice less than 5 seconds after the last notice. */
  "too_soon",
  /** update_costs with a purchase nobody shares, or a sharer who isn't a current guest. */
  "invalid_sharer",
  "internal_error",
] as const;

export type HostActionErrorCode = (typeof hostActionErrorCodes)[number];

export const HostActionErrorSchema = z.strictObject({
  error: z.enum(hostActionErrorCodes),
});
