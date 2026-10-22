// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of a hot take; the wizard and host-actions use them too. */
export const hottakesLimits = {
  text: 120,
  /** Hot takes in one event. */
  takes: 20,
} as const;

/** One hot take: a statement guests agree or disagree with, in one language. */
export const HotTakeSchema = z.strictObject({
  text: z.string().trim().min(1).max(hottakesLimits.text),
});

export type HotTake = z.infer<typeof HotTakeSchema>;

export const HotTakesSchema = z.array(HotTakeSchema).max(hottakesLimits.takes);
