import { aw } from "./aw";
import type { NicheId } from "./ids";
import type { NicheConfig } from "./types";

export type { NicheId } from "./ids";

/**
 * Every niche. Add a niche by adding a config file, listing it here and adding
 * its id to ./ids.ts.
 */
export const niches = { aw } satisfies Record<NicheId, NicheConfig>;

export function getNiche(id: NicheId): NicheConfig {
  return niches[id];
}

/** Narrows an untrusted value, e.g. a niche id read from the database. */
export function isNicheId(value: unknown): value is NicheId {
  return typeof value === "string" && Object.hasOwn(niches, value);
}
