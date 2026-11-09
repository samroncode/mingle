/** The part of a reported match a table needs. */
export interface StandingsMatch {
  winnerId: string;
  loserId: string;
  winnerScore: number | null;
  loserScore: number | null;
}

/** One player's line in a competition's table. */
export interface StandingsRow {
  playerId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  /** Points scored minus points conceded; matches without scores add zero. */
  diff: number;
}

/** A competition's ranked table; only competitions with a match have one. */
export interface CompetitionTable {
  competitionId: string;
  name: string;
  rows: StandingsRow[];
}

/** The score difference of a match for its winner (zero without scores). */
function margin(match: StandingsMatch): number {
  if (match.winnerScore === null || match.loserScore === null) return 0;
  return match.winnerScore - match.loserScore;
}

function rowFor(
  rows: Map<string, StandingsRow>,
  playerId: string,
  names: ReadonlyMap<string, string>,
): StandingsRow {
  const existing = rows.get(playerId);
  if (existing) return existing;
  const row = {
    playerId,
    name: names.get(playerId) ?? "",
    played: 0,
    wins: 0,
    losses: 0,
    diff: 0,
  };
  rows.set(playerId, row);
  return row;
}

/**
 * Ranks the players of one competition: most wins first, then fewest losses,
 * then best score difference, then display name. Only players with a match
 * appear, so nobody played gives an empty table.
 */
export function standings(
  matches: StandingsMatch[],
  names: ReadonlyMap<string, string>,
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const match of matches) {
    const winner = rowFor(rows, match.winnerId, names);
    const loser = rowFor(rows, match.loserId, names);
    winner.played += 1;
    winner.wins += 1;
    winner.diff += margin(match);
    loser.played += 1;
    loser.losses += 1;
    loser.diff -= margin(match);
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.diff - a.diff ||
      a.name.localeCompare(b.name),
  );
}

/** One ranked table per competition that has at least one match, in list order. */
export function tablesOf(
  competitions: Array<{ id: string; name: string }>,
  matches: Array<StandingsMatch & { competitionId: string }>,
  names: ReadonlyMap<string, string>,
): CompetitionTable[] {
  return competitions
    .map((competition) => ({
      competitionId: competition.id,
      name: competition.name,
      rows: standings(
        matches.filter((match) => match.competitionId === competition.id),
        names,
      ),
    }))
    .filter((table) => table.rows.length > 0);
}
