/** Scores (in any order) and the place each one gets. Shared with the db tests. */
export const placeCases: Array<{ scores: number[]; places: number[] }> = [
  { scores: [], places: [] },
  { scores: [4], places: [1] },
  { scores: [5, 3, 1], places: [1, 2, 3] },
  { scores: [3, 3, 1], places: [1, 1, 3] },
  { scores: [2, 2, 2, 0], places: [1, 1, 1, 4] },
  { scores: [1, 3, 3, 2], places: [4, 1, 1, 3] },
  { scores: [0, 0], places: [1, 1] },
];
