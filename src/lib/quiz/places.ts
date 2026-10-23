/**
 * Competition places for scores, best first: equal scores share a place and
 * the next place skips ahead (1, 1, 3). `quiz_scores` in the database ranks
 * the same way; `places.cases.ts` holds the cases both are tested against.
 */
export function competitionPlaces(scores: number[]): number[] {
  return scores.map(
    (score) => 1 + scores.filter((other) => other > score).length,
  );
}
