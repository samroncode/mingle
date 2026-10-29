import type { MemberRow } from "@/api/events";

/**
 * The guests a voter can vote for: guests with a display name, never the
 * voter themselves, A to Z by the event's language.
 */
export function voteCandidates(
  members: MemberRow[],
  voterId: string,
  language: string,
): Array<{ userId: string; name: string }> {
  return members
    .filter(
      (m) =>
        m.role === "guest" && m.user_id !== voterId && m.display_name !== null,
    )
    .map((m) => ({ userId: m.user_id, name: m.display_name ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
}
