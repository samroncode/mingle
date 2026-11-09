// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of the competitions; the wizard and host-actions use them too. */
export const competitionsLimits = {
  /** Characters in a competition's name, once trimmed. */
  name: 40,
  /** Competitions in one event. */
  perEvent: 5,
} as const;

/** The name of one competition: host-written, never translated. */
export const CompetitionNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(competitionsLimits.name);

/** One competition as the wizard sends it: just a name. */
export const CompetitionSchema = z.strictObject({
  name: CompetitionNameSchema,
});

export type Competition = z.infer<typeof CompetitionSchema>;

export const CompetitionsSchema = z
  .array(CompetitionSchema)
  .max(competitionsLimits.perEvent);
