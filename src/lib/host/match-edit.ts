import type { MatchChange } from "@/lib/schemas/host-actions";

/** What the host has entered for one match. Scores are the raw text of the fields. */
export interface MatchEditForm {
  /** The player who won. */
  winnerId: string;
  /** The winner's score. */
  winnerScore: string;
  /** The loser's score. */
  loserScore: string;
}

export type MatchEditProblem = "invalid_score" | "score_mismatch";

export type MatchEditCheck =
  | { ok: true; change: Extract<MatchChange, { type: "edit" }> }
  | { ok: false; problem: MatchEditProblem };

const SCORE = /^\d{1,3}$/;

/**
 * Checks an edit the way the database will: both scores or neither, 0 to 999,
 * and the winner's higher than the loser's.
 */
export function checkMatchEdit(
  matchId: string,
  form: MatchEditForm,
): MatchEditCheck {
  const base = { type: "edit", id: matchId, winnerId: form.winnerId } as const;
  const winner = form.winnerScore.trim();
  const loser = form.loserScore.trim();
  if (winner === "" && loser === "") return { ok: true, change: base };
  if (!SCORE.test(winner) || !SCORE.test(loser)) {
    return { ok: false, problem: "invalid_score" };
  }
  if (Number(winner) <= Number(loser)) {
    return { ok: false, problem: "score_mismatch" };
  }
  return {
    ok: true,
    change: {
      ...base,
      score: { winner: Number(winner), loser: Number(loser) },
    },
  };
}
