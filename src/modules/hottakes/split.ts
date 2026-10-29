import type { HotTakeSplit } from "@/api/hottakes";

/** How the room went on a hot take, as the screens say it. */
export type SplitView =
  | { kind: "none" }
  | {
      /** `even` is an exact 50/50. */
      kind: "even" | "agree" | "disagree";
      agreePercent: number;
      disagreePercent: number;
    };

/**
 * The split as whole-number percentages that add up to 100, and which side
 * has the majority (`agree` / `disagree`), `even` for an exact tie, or `none`
 * when nobody answered.
 */
export function splitView({ agree, disagree }: HotTakeSplit): SplitView {
  const total = agree + disagree;
  if (total === 0) return { kind: "none" };
  const agreePercent = Math.round((agree / total) * 100);
  const kind =
    agree === disagree ? "even" : agree > disagree ? "agree" : "disagree";
  return { kind, agreePercent, disagreePercent: 100 - agreePercent };
}

/** Where a guest stands in the room, or null if they didn't answer. */
export type Standing = "majority" | "minority" | "even";

/**
 * The guest's own side against the room: with the majority, in the minority,
 * or in an evenly split room. Nothing if they didn't answer (or nobody did).
 */
export function guestStanding(
  answer: boolean | null,
  split: HotTakeSplit,
): Standing | null {
  if (answer === null || split.agree + split.disagree === 0) return null;
  if (split.agree === split.disagree) return "even";
  const agreeWins = split.agree > split.disagree;
  return answer === agreeWins ? "majority" : "minority";
}
