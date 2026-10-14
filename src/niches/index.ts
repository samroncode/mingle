import { aw } from "./aw";
import type { NicheConfig } from "./types";

/** Every niche. Add a niche by adding a config file and listing it here. */
export const niches = { aw } satisfies Record<string, NicheConfig>;

export type NicheId = keyof typeof niches;

export function getNiche(id: NicheId): NicheConfig {
  return niches[id];
}

/** Narrows an untrusted value, e.g. a niche id read from the database. */
export function isNicheId(value: unknown): value is NicheId {
  return typeof value === "string" && Object.hasOwn(niches, value);
}
