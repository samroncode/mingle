// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of an award category; the wizard and host-actions use them too. */
export const awardsLimits = {
  text: 120,
  /** Categories in one event. */
  categories: 20,
} as const;

/** One award category: the "Most likely to…" text, in one language. */
export const AwardCategorySchema = z.strictObject({
  text: z.string().trim().min(1).max(awardsLimits.text),
});

export type AwardCategory = z.infer<typeof AwardCategorySchema>;

export const AwardCategoriesSchema = z
  .array(AwardCategorySchema)
  .max(awardsLimits.categories);
