import type { Party } from "@/lib/schemas/party";

export type Winner = NonNullable<Party["winners"]>[number];

const key = (winner: Winner) => JSON.stringify([winner.title, winner.name]);

/**
 * The winners to congratulate: those in `next` that were not in `previous`.
 * The first snapshot (`previous` is null), edits, deletes and a hidden slide
 * greet nobody; showing a hidden slide again does not greet the old winners.
 */
export function newWinners(previous: Party | null, next: Party): Winner[] {
  if (!previous || next.winnersHidden) return [];
  const before = previous.winners ?? [];
  const after = next.winners ?? [];
  // An edit or delete never makes the list longer; only an add does.
  if (after.length <= before.length) return [];
  const remaining = new Map<string, number>();
  for (const winner of before) {
    remaining.set(key(winner), (remaining.get(key(winner)) ?? 0) + 1);
  }
  return after.filter((winner) => {
    const count = remaining.get(key(winner)) ?? 0;
    if (count === 0) return true;
    remaining.set(key(winner), count - 1);
    return false;
  });
}
