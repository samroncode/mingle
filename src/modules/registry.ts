/**
 * The activity modules in v1. Their views are described by `ModuleDefinition`
 * (types.ts) and listed in definitions.ts.
 */
export const moduleIds = ["quiz", "awards", "hottakes"] as const;
export type ModuleId = (typeof moduleIds)[number];
