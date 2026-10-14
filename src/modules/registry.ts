/**
 * The activity modules in v1. The shared module interface is added together
 * with the first module.
 */
export const moduleIds = ["quiz", "awards", "hottakes"] as const;
export type ModuleId = (typeof moduleIds)[number];
