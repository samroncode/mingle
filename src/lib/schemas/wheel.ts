// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of the Lucky wheel; the app and host-actions use them too. */
export const wheelLimits = {
  /** Characters in a custom entry, once trimmed. */
  label: 30,
  /** Entries on one event's wheel, taken off ones included. */
  perEvent: 24,
} as const;

/** The text of a custom entry: host-written, never translated. */
export const WheelLabelSchema = z.string().trim().min(1).max(wheelLimits.label);

/** The guests to put on the wheel in one go: at least one, at most a full wheel. */
export const WheelGuestIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(wheelLimits.perEvent);
