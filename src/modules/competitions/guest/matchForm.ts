import type { MatchReport } from "@/api/competitions";

/** Who won, from the point of view of the guest reporting. */
export type Outcome = "won" | "lost";

/** What the guest has entered so far. Scores are the raw text of the fields. */
export interface MatchForm {
  competitionId: string | undefined;
  opponentId: string | undefined;
  outcome: Outcome | undefined;
  /** The guest's own score. */
  mine: string;
  /** The opponent's score. */
  theirs: string;
}

export const emptyMatchForm: MatchForm = {
  competitionId: undefined,
  opponentId: undefined,
  outcome: undefined,
  mine: "",
  theirs: "",
};

/** Why the form can't be sent. `incomplete` has no message: the button stays off. */
export type FormProblem = "incomplete" | "invalid_score" | "score_mismatch";

export type FormCheck =
  { ok: true; report: MatchReport } | { ok: false; problem: FormProblem };

const SCORE = /^\d{1,3}$/;

/**
 * Checks the form the way the database will, so the guest hears about a
 * score that doesn't fit before sending: both scores or neither, 0 to 999,
 * and the winner's higher than the loser's.
 */
export function checkMatchForm(
  eventId: string,
  userId: string,
  form: MatchForm,
): FormCheck {
  const { competitionId, opponentId, outcome } = form;
  if (!competitionId || !opponentId || !outcome) {
    return { ok: false, problem: "incomplete" };
  }
  const base = {
    eventId,
    competitionId,
    winnerId: outcome === "won" ? userId : opponentId,
    loserId: outcome === "won" ? opponentId : userId,
  };

  const mine = form.mine.trim();
  const theirs = form.theirs.trim();
  if (mine === "" && theirs === "") return { ok: true, report: base };
  if (!SCORE.test(mine) || !SCORE.test(theirs)) {
    return { ok: false, problem: "invalid_score" };
  }
  const winner = Number(outcome === "won" ? mine : theirs);
  const loser = Number(outcome === "won" ? theirs : mine);
  if (winner <= loser) return { ok: false, problem: "score_mismatch" };
  return { ok: true, report: { ...base, score: { winner, loser } } };
}
