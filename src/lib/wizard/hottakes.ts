import type { Language } from "@/i18n/language";
import {
  HotTakeSchema,
  hottakesLimits,
  type HotTake,
} from "@/lib/schemas/hottakes";
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

/** How many of the niche's hot takes are picked for the host to start from. */
export const defaultHotTakesSize = 8;

/** The fields of a hot take the host wrote, as typed: it may be unfinished. */
export interface OwnHotTakeFields {
  text: string;
}

/** A hot take the host wrote; the key tells it apart across edits and moves. */
export type OwnHotTake = OwnItem<OwnHotTakeFields>;

/** One hot take, in the order it will be played. */
export type HotTakesItem = PickItem<OwnHotTakeFields>;

/** The hot takes as the host has built them so far. */
export type HotTakesDraft = PickList<OwnHotTakeFields>;

export const emptyHotTakes: HotTakesDraft = emptyPickList();

export type HotTakesAction = PickListAction<OwnHotTakeFields>;

const hotTakesRules: PickListRules<OwnHotTakeFields> = {
  limit: hottakesLimits.takes,
  blank: () => ({ text: "" }),
};

/** Picks `size` of the niche's hot takes at random; `random` is injectable. */
export function pickDefaultHotTakeIds(
  niche: NicheId,
  random: () => number = Math.random,
  size: number = defaultHotTakesSize,
): string[] {
  const ids = getNiche(niche).hottakes.map((take) => take.id);
  return pickDefaultIds(ids, size, random);
}

export const resetBuiltinHotTakes = resetBuiltinItems<OwnHotTakeFields>;

export function hotTakesReducer(
  takes: HotTakesDraft,
  action: HotTakesAction,
): HotTakesDraft {
  return pickListReducer(takes, action, hotTakesRules);
}

function toTake(own: OwnHotTake): HotTake {
  return { text: own.text.trim() };
}

/**
 * The hot takes as the request carries them, in order: built-in ones copied
 * in the event language, the host's own trimmed. A built-in id the niche no
 * longer has is left out.
 */
export function toHotTakes(
  niche: NicheId,
  language: Language,
  takes: HotTakesDraft,
): HotTake[] {
  const builtin = new Map(getNiche(niche).hottakes.map((h) => [h.id, h]));
  return takes.items.flatMap((item): HotTake[] => {
    if (item.kind === "own") return [toTake(item)];
    const content = builtin.get(item.id);
    return content ? [{ text: content.texts[language] }] : [];
  });
}

/** Keys of the host's own hot takes that break the shared hot take schema. */
export function invalidOwnHotTakeKeys(takes: HotTakesDraft): string[] {
  return takes.items.flatMap((item) =>
    item.kind === "own" && !HotTakeSchema.safeParse(toTake(item)).success
      ? [item.key]
      : [],
  );
}

export const hotTakesSlice = wizardSlice({
  empty: emptyHotTakes,
  reducer: hotTakesReducer,
  resetBuiltin: resetBuiltinHotTakes,
  invalidKeys: invalidOwnHotTakeKeys,
  summaryKey: "wizard.summary.hotTakes",
  toRequest: toHotTakes,
});
