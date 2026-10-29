import type { Language } from "@/i18n/language";
import type { NicheId } from "@/niches";

/**
 * What the wizard needs from an activity that has a step: its part of the
 * draft (`D`), the actions on it (`A`) and the items it adds to the create
 * request (`R`). Plain functions, so `state.ts` can treat every activity alike.
 */
export interface WizardSlice<D, A, R> {
  empty: D;
  reducer: (draft: D, action: A) => D;
  /** Drops the built-in items, which belong to one niche, when it changes. */
  resetBuiltin: (draft: D) => D;
  /** Keys of the host's own items that break the shared schema. */
  invalidKeys: (draft: D) => string[];
  /** i18n key of the summary line; it takes the item count as `count`. */
  summaryKey: string;
  toRequest: (niche: NicheId, language: Language, draft: D) => R[];
}

/** Gives a slice its types without writing them out. */
export function wizardSlice<D, A, R>(
  slice: WizardSlice<D, A, R>,
): WizardSlice<D, A, R> {
  return slice;
}
