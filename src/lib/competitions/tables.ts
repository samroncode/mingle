import { standings, type StandingsMatch, type StandingsRow } from "./standings";

/** A competition's ranked table; only competitions with a match have one. */
export interface CompetitionTable {
  competitionId: string;
  name: string;
  rows: StandingsRow[];
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
