import { z } from "zod";
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

export const NicheConfigSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+$/),
  /** i18n keys, never literal text, so the copy exists in sv and en. */
  nameKey: z.string().min(1),
  descriptionKey: z.string().min(1),
  theme: z.partialRecord(z.enum(themeTokens), z.string().min(1)),
  /** Activities that start switched on in the create flow. */
  defaultModules: z.array(z.enum(moduleIds)),
  /** Guidance for AI suggestions. English, never shown in the UI. */
  promptHints: z.string().min(1),
});

export type NicheConfig = z.infer<typeof NicheConfigSchema>;
