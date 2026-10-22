import type { MemberRow } from "@/api/events";

/**
 * The guests who have a display name; the host, the TV and a guest who has
 * not picked a name yet are never listed, greeted or counted.
 */
export function namedGuests(members: MemberRow[]): MemberRow[] {
  return members.filter(
    (member) => member.role === "guest" && !!member.display_name,
  );
}

export function countGuests(members: MemberRow[]): number {
  return namedGuests(members).length;
}

/** The names of the guests who have joined, in the order given. */
export function guestNames(members: MemberRow[]): string[] {
  return namedGuests(members).map((guest) => guest.display_name ?? "");
}

/**
 * The named guests in `next` that were not in `previous`. The first snapshot
 * (`previous` is null) has no new guests, and a rename is not a new guest.
 */
export function newGuests(
  previous: MemberRow[] | null,
  next: MemberRow[],
): MemberRow[] {
  if (!previous) return [];
  const known = new Set(previous.map((member) => member.user_id));
  return namedGuests(next).filter((guest) => !known.has(guest.user_id));
}
