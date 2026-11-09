/** One reported match, reduced to what a table needs. */
export interface StandingsMatch {
  winnerId: string;
  loserId: string;
  winnerScore: number | null;
  loserScore: number | null;
}

/** One player's row in a competition's table. */
export interface StandingsRow {
  userId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  /** Points scored minus points conceded; matches without scores count as 0. */
  difference: number;
}

/** Display names compare the same way for every viewer. */
const byName = new Intl.Collator("sv", { sensitivity: "base" });

/**
 * A competition's table: wins (most first), then fewer losses, then score
 * difference (highest first), then display name. Only players with at least one
 * match appear. `names` maps a member id to their display name.
 */
export function standings(
  matches: readonly StandingsMatch[],
  names: ReadonlyMap<string, string>,
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  const row = (userId: string): StandingsRow => {
    const existing = rows.get(userId);
    if (existing) return existing;
    const created = {
      userId,
      name: names.get(userId) ?? "",
      played: 0,
      wins: 0,
      losses: 0,
      difference: 0,
    };
    rows.set(userId, created);
    return created;
  };

  for (const match of matches) {
    const margin =
      match.winnerScore !== null && match.loserScore !== null
        ? match.winnerScore - match.loserScore
        : 0;
    const winner = row(match.winnerId);
    winner.played += 1;
    winner.wins += 1;
    winner.difference += margin;
    const loser = row(match.loserId);
    loser.played += 1;
    loser.losses += 1;
    loser.difference -= margin;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.difference - a.difference ||
      byName.compare(a.name, b.name) ||
      a.userId.localeCompare(b.userId),
  );
}
