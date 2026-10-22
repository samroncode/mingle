import { z } from "zod";
import { supportedLanguages } from "@/i18n/language";
import { AwardCategorySchema } from "@/lib/schemas/awards";
import { PartySchema } from "@/lib/schemas/party";
import { QuizQuestionTextSchema } from "@/lib/schemas/quiz";
import { moduleIds } from "@/modules/registry";

/**
 * The shadcn tokens from `:root` in src/index.css that a niche may override.
 * Niches never add tokens of their own, so components only ever use one set.
 */
export const themeTokens = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "radius",
] as const;

/**
 * A ready-made quiz question: the same question in every supported language,
 * with one right option shared by all of them. The text is built-in content in
 * the event language, copied into the event when the host picks it. The id is
 * stable, so a saved wizard draft can refer to the question.
 */
export const QuizContentSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+-[a-z0-9-]+$/),
  correct: z.number().int().min(0).max(3),
  texts: z.record(z.enum(supportedLanguages), QuizQuestionTextSchema),
});

export type QuizContent = z.infer<typeof QuizContentSchema>;

/**
 * A ready-made award category: the same "Most likely to…" category in every
 * supported language. The text is built-in content in the event language,
 * copied into the event when the host picks it. The id is stable, so a saved
 * wizard draft can refer to the category.
 */
export const AwardContentSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+-[a-z0-9-]+$/),
  texts: z.record(z.enum(supportedLanguages), AwardCategorySchema.shape.text),
});

export type AwardContent = z.infer<typeof AwardContentSchema>;

export const NicheConfigSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  /** i18n keys, never literal text, so the copy exists in sv and en. */
  nameKey: z.string().min(1),
  descriptionKey: z.string().min(1),
  theme: z.partialRecord(z.enum(themeTokens), z.string().min(1)),
  /** Activities that start switched on in the create flow. */
  defaultModules: z.array(z.enum(moduleIds)),
  /**
   * Ready welcome text for the party screen, one per supported language. It is
   * built-in content in the event language (not UI text) and the host may edit
   * it, so it must pass the party schema's welcome limit.
   */
  welcome: z.record(
    z.enum(supportedLanguages),
    PartySchema.shape.welcome.unwrap(),
  ),
  /** Ready-made quiz questions the host picks from. */
  quiz: z.array(QuizContentSchema),
  /** Ready-made award categories the host picks from. */
  awards: z.array(AwardContentSchema),
  /** Guidance for AI suggestions. English, never shown in the UI. */
  promptHints: z.string().min(1),
});

export type NicheConfig = z.infer<typeof NicheConfigSchema>;
