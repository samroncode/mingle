// The host-actions request and response contract, shared by the app and the
// Edge Function. The function imports this file by relative path under Deno:
// only `zod` and relative imports with a `.ts` extension, and no browser or
// Node APIs. Later actions add their schema to `HostActionRequestSchema`.
import { z } from "zod";
import { supportedLanguages } from "../../i18n/language.ts";
import { moduleIds } from "../../modules/registry.ts";
import { nicheIds } from "../../niches/ids.ts";
import { PartySchema } from "./party.ts";

/** 6 characters without look-alikes (no 0/O, no 1/I/L), as in the database. */
export const EventCodeSchema = z
  .string()
  .regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);

/** 32 random bytes, base64url-encoded without padding. */
export const AdminKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const CreateEventRequestSchema = z.strictObject({
  action: z.literal("create_event"),
  niche: z.enum(nicheIds),
  language: z.enum(supportedLanguages),
  /** The activities the host kept switched on. May be empty. */
  enabledModules: z
    .array(z.enum(moduleIds))
    .refine((ids) => new Set(ids).size === ids.length, "duplicate module"),
  party: PartySchema,
});

export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;

/** The only response that ever contains the admin key. */
export const CreateEventResponseSchema = z.strictObject({
  code: EventCodeSchema,
  key: AdminKeySchema,
});

export type CreateEventResponse = z.infer<typeof CreateEventResponseSchema>;

/** Every body host-actions accepts, told apart by `action`. */
export const HostActionRequestSchema = z.discriminatedUnion("action", [
  CreateEventRequestSchema,
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
  "origin_not_allowed",
  "method_not_allowed",
  "payload_too_large",
  "rate_limited",
  "internal_error",
] as const;

export type HostActionErrorCode = (typeof hostActionErrorCodes)[number];

export const HostActionErrorSchema = z.strictObject({
  error: z.enum(hostActionErrorCodes),
});
