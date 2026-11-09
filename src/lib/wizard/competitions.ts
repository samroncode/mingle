import type { Language } from "@/i18n/language";
import {
  CompetitionSchema,
  competitionsLimits,
  type Competition,
} from "@/lib/schemas/competitions";
import { getNiche, type NicheId } from "@/niches";
import {
  pickListReducer,
  resetBuiltinItems,
  type OwnItem,
  type PickItem,
  type PickList,
  type PickListAction,
  type PickListRules,
} from "./pick-list";
import { wizardSlice } from "./slice";

/** The fields of a competition the host wrote, as typed: it may be unfinished. */
export interface OwnCompetitionFields {
  name: string;
}

/** A competition the host wrote; the key tells it apart across edits. */
export type OwnCompetition = OwnItem<OwnCompetitionFields>;

/** One competition, in the order it will be listed. */
export type CompetitionsItem = PickItem<OwnCompetitionFields>;

/** The competitions as the host has built them so far. */
export type CompetitionsDraft = PickList<OwnCompetitionFields>;

/**
 * Nothing is picked until the host ticks a suggestion or writes their own, so
 * the list counts as seeded from the start: there is no default pick.
 */
export const emptyCompetitions: CompetitionsDraft = {
  seeded: true,
  items: [],
};

export type CompetitionsAction = PickListAction<OwnCompetitionFields>;

const competitionsRules: PickListRules<OwnCompetitionFields> = {
  limit: competitionsLimits.perEvent,
  blank: () => ({ name: "" }),
};

export function competitionsReducer(
  list: CompetitionsDraft,
  action: CompetitionsAction,
): CompetitionsDraft {
  return pickListReducer(list, action, competitionsRules);
}

/** After a niche change the old suggestions go; the host's own stay. */
function resetBuiltinCompetitions(list: CompetitionsDraft): CompetitionsDraft {
  return { ...resetBuiltinItems(list), seeded: true };
}

function toCompetition(own: OwnCompetition): Competition {
  return { name: own.name.trim() };
}

/**
 * The competitions as the request carries them, in order: suggestions copied
 * in the event language, the host's own trimmed. A suggestion the niche no
 * longer has is left out.
 */
export function toCompetitions(
  niche: NicheId,
  language: Language,
  list: CompetitionsDraft,
): Competition[] {
  const builtin = new Map(getNiche(niche).competitions.map((c) => [c.id, c]));
  return list.items.flatMap((item): Competition[] => {
    if (item.kind === "own") return [toCompetition(item)];
    const content = builtin.get(item.id);
    return content ? [{ name: content.names[language] }] : [];
  });
}

/** Keys of the host's own competitions that break the shared schema. */
export function invalidOwnCompetitionKeys(list: CompetitionsDraft): string[] {
  return list.items.flatMap((item) =>
    item.kind === "own" &&
    !CompetitionSchema.safeParse(toCompetition(item)).success
      ? [item.key]
      : [],
  );
}

export const competitionsSlice = wizardSlice({
  empty: emptyCompetitions,
  reducer: competitionsReducer,
  resetBuiltin: resetBuiltinCompetitions,
  invalidKeys: invalidOwnCompetitionKeys,
  summaryKey: "wizard.summary.competitions",
  toRequest: toCompetitions,
});
