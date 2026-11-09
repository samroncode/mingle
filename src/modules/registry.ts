/**
 * The activity modules in v1. Their views are described by `ModuleDefinition`
 * (types.ts) and listed in definitions.ts.
 */
export const moduleIds = [
  "quiz",
  "awards",
  "hottakes",
  "competitions",
] as const;
export type ModuleId = (typeof moduleIds)[number];

export function isModuleId(value: string | null): value is ModuleId {
  return moduleIds.some((id) => id === value);
}
