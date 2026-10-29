import type { AwardWinner } from "@/api/awards";
import type { MemberRow } from "@/api/events";

/** The winners of a category as the screens say it: names, and the votes. */
export type WinnerLine =
  { kind: "none" } | { kind: "winners"; names: string[]; votes: number };

/**
 * The display names of a category's winners (A to Z by the event language,
 * so a tie reads the same everywhere) and the vote count they share. A winner
 * who is no longer a member is left out; nobody left means no winner.
 */
export function winnerLine(
  winners: AwardWinner[],
  members: MemberRow[],
  language: string,
): WinnerLine {
  const names = winners
    .map((w) => members.find((m) => m.user_id === w.userId)?.display_name)
    .filter((name): name is string => !!name)
    .sort((a, b) => a.localeCompare(b, language));
  const votes = winners[0]?.votes;
  if (names.length === 0 || votes === undefined) return { kind: "none" };
  return { kind: "winners", names, votes };
}

/** "Anna", "Anna and Bertil", "Anna, Bertil and Cecilia". */
export function joinNames(names: string[], language: string): string {
  return new Intl.ListFormat(language, {
    style: "long",
    type: "conjunction",
  }).format(names);
}
