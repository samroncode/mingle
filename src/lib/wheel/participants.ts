import type { MemberRow } from "@/api/events";
import type { WheelEntryView } from "@/api/wheel";
import { wheelLimits } from "@/lib/schemas/wheel";
import type { WheelContent } from "@/niches/types";
import { namedGuests } from "@/partyscreen/guests";

/** A joined guest and whether they are on the wheel. */
export interface GuestChoice {
  userId: string;
  name: string;
  /** The guest's entry, if they ever were put on the wheel. */
  entryId?: string;
  onWheel: boolean;
}

/** The guests A to Z, each with their wheel state. */
export function guestChoices(
  members: MemberRow[],
  entries: WheelEntryView[],
  language: string,
): GuestChoice[] {
  const byMember = new Map(
    entries.flatMap((e) => (e.memberId ? [[e.memberId, e] as const] : [])),
  );
  return namedGuests(members)
    .map((guest) => {
      const entry = byMember.get(guest.user_id);
      return {
        userId: guest.user_id,
        name: guest.display_name ?? "",
        entryId: entry?.id,
        onWheel: entry?.state === "on",
      };
    })
    .sort((a, b) =>
      a.name.localeCompare(b.name, language, { sensitivity: "base" }),
    );
}

/** Own entries (not guests), on the wheel or taken off. */
export function customEntries(
  entries: WheelEntryView[],
  state: WheelEntryView["state"],
) {
  return entries.filter((e) => e.kind === "custom" && e.state === state);
}

/** Entries that are taken off the wheel, guests and own ones alike. */
export function takenOff(entries: WheelEntryView[]) {
  return entries.filter((e) => e.state === "off");
}

/** True when no more entries fit; taken-off ones count, as in the database. */
export function wheelIsFull(entries: WheelEntryView[]): boolean {
  return entries.length >= wheelLimits.perEvent;
}

/** What "select all" and "select none" change, as host actions. */
export type SelectionStep =
  | { type: "add_guests"; ids: string[] }
  | { type: "put_back"; id: string }
  | { type: "take_off"; id: string };

/** Steps that put every guest on the wheel, as many as fit. */
export function selectAllSteps(
  choices: GuestChoice[],
  entries: WheelEntryView[],
): SelectionStep[] {
  const steps: SelectionStep[] = choices
    .filter((c) => c.entryId && !c.onWheel)
    .map((c) => ({ type: "put_back", id: c.entryId as string }));
  const room = wheelLimits.perEvent - entries.length;
  const ids = choices
    .filter((c) => !c.entryId)
    .map((c) => c.userId)
    .slice(0, Math.max(room, 0));
  if (ids.length > 0) steps.push({ type: "add_guests", ids });
  return steps;
}

/** Steps that take every guest off the wheel; own entries stay. */
export function selectNoneSteps(choices: GuestChoice[]): SelectionStep[] {
  return choices
    .filter((c) => c.entryId && c.onWheel)
    .map((c) => ({ type: "take_off", id: c.entryId as string }));
}

/** The niche's suggestions in the event language that aren't already entries. */
export function openSuggestions(
  suggestions: WheelContent[],
  language: string,
  entries: WheelEntryView[],
): Array<{ id: string; text: string }> {
  const used = new Set(
    entries.flatMap((e) => (e.label ? [e.label.trim().toLowerCase()] : [])),
  );
  return suggestions.flatMap((s) => {
    const text = (s.texts as Record<string, string | undefined>)[language];
    return text && !used.has(text.toLowerCase()) ? [{ id: s.id, text }] : [];
  });
}
