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
import { HotTakesSchema } from "./hottakes.ts";
import { PartySchema } from "./party.ts";
import { QuizQuestionsSchema } from "./quiz.ts";

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

/** Every body host-actions accepts, told apart by `action`. */
export const HostActionRequestSchema = z.discriminatedUnion("action", [
  CreateEventRequestSchema,
  ClaimHostRequestSchema,
  SetFlowRequestSchema,
  UpdatePartyContentRequestSchema,
  UpdateQuizRequestSchema,
  UpdateAwardsRequestSchema,
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
   * once the event has ended; and the same for an awards edit.
   */
  "invalid_transition",
  /** start_module for an activity the host turned off, quiz questions or award categories for it. */
  "module_disabled",
  /** start_module for an activity with no steps, such as a quiz without questions. */
  "module_empty",
  /** start_module for an activity whose steps have all been played. */
  "module_finished",
  "internal_error",
] as const;

export type HostActionErrorCode = (typeof hostActionErrorCodes)[number];

export const HostActionErrorSchema = z.strictObject({
  error: z.enum(hostActionErrorCodes),
});
