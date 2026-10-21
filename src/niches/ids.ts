/**
 * The id of every niche, with no other imports, so the shared request schemas
 * in src/lib/schemas/ (which host-actions also imports, under Deno) can check a
 * niche without loading the configs. `niches` in ./index.ts must list exactly
 * these; the typecheck enforces it.
 */
export const nicheIds = ["aw"] as const;
export type NicheId = (typeof nicheIds)[number];
