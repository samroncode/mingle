import type { MemberRow } from "@/api/events";
import { namedGuests } from "@/partyscreen/guests";

/** A guest the host can rename: their user id and current display name. */
export type ListedGuest = { userId: string; name: string };

/** The named guests A to Z in the event's language, ignoring case. */
export function sortedGuests(
  members: MemberRow[],
  language: string,
): ListedGuest[] {
  return namedGuests(members)
    .map((guest) => ({
      userId: guest.user_id,
      name: guest.display_name ?? "",
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name, language, { sensitivity: "base" }),
    );
}
