import type { Language } from "@/i18n/language";
import {
  AwardCategorySchema,
  awardsLimits,
  type AwardCategory,
} from "@/lib/schemas/awards";
import { getNiche, type NicheId } from "@/niches";
import {
  emptyPickList,
  pickDefaultIds,
  pickListReducer,
  resetBuiltinItems,
  type OwnItem,
  type PickItem,
  type PickList,
  type PickListAction,
  type PickListRules,
} from "./pick-list";
import { wizardSlice } from "./slice";

/** How many of the niche's categories are picked for the host to start from. */
export const defaultAwardsSize = 8;

/** The fields of a category the host wrote, as typed: it may be unfinished. */
export interface OwnCategoryFields {
  text: string;
}

/** A category the host wrote; the key tells it apart across edits and moves. */
export type OwnCategory = OwnItem<OwnCategoryFields>;

/** One category in the awards, in the order it will be played. */
export type AwardsItem = PickItem<OwnCategoryFields>;

/** The awards as the host has built them so far. */
export type AwardsDraft = PickList<OwnCategoryFields>;

export const emptyAwards: AwardsDraft = emptyPickList();

export type AwardsAction = PickListAction<OwnCategoryFields>;

const awardsRules: PickListRules<OwnCategoryFields> = {
  limit: awardsLimits.categories,
  blank: () => ({ text: "" }),
};

/** Picks `size` of the niche's categories at random; `random` is injectable. */
export function pickDefaultAwardIds(
  niche: NicheId,
  random: () => number = Math.random,
  size: number = defaultAwardsSize,
): string[] {
  const ids = getNiche(niche).awards.map((award) => award.id);
  return pickDefaultIds(ids, size, random);
}

export const resetBuiltinAwards = resetBuiltinItems<OwnCategoryFields>;

export function awardsReducer(
  awards: AwardsDraft,
  action: AwardsAction,
): AwardsDraft {
  return pickListReducer(awards, action, awardsRules);
}

function toCategory(own: OwnCategory): AwardCategory {
  return { text: own.text.trim() };
}

/**
 * The categories as the request carries them, in order: built-in ones copied
 * in the event language, the host's own trimmed. A built-in id the niche no
 * longer has is left out.
 */
export function toAwardCategories(
  niche: NicheId,
  language: Language,
  awards: AwardsDraft,
): AwardCategory[] {
  const builtin = new Map(getNiche(niche).awards.map((a) => [a.id, a]));
  return awards.items.flatMap((item): AwardCategory[] => {
    if (item.kind === "own") return [toCategory(item)];
    const content = builtin.get(item.id);
    return content ? [{ text: content.texts[language] }] : [];
  });
}

/** Keys of the host's own categories that break the shared category schema. */
export function invalidOwnAwardKeys(awards: AwardsDraft): string[] {
  return awards.items.flatMap((item) =>
    item.kind === "own" &&
    !AwardCategorySchema.safeParse(toCategory(item)).success
      ? [item.key]
      : [],
  );
}

export const awardsSlice = wizardSlice({
  empty: emptyAwards,
  reducer: awardsReducer,
  resetBuiltin: resetBuiltinAwards,
  invalidKeys: invalidOwnAwardKeys,
  summaryKey: "wizard.summary.awardCategories",
  toRequest: toAwardCategories,
});
