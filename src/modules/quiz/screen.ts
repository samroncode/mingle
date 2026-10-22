import type { QuizProgress, QuizQuestionView } from "@/api/quiz";
import type { EventRow } from "@/api/events";

/** The letters of a question's four options, as the TV and phones show them. */
export const optionLetters = ["A", "B", "C", "D"] as const;

type QuizFlow = Pick<EventRow, "current_module" | "current_step" | "phase">;

/** What the TV and the phone show while the quiz runs. */
export type QuizScreen =
  | { kind: "loading" }
  /** "Question 3 of 10, get ready" / "Next question coming". */
  | { kind: "idle"; number: number; total: number }
  | {
      kind: "open";
      number: number;
      total: number;
      question: QuizQuestionView;
    }
  | {
      kind: "revealed";
      number: number;
      total: number;
      question: QuizQuestionView;
      correct: number;
    }
  /** After the last question (step = number of questions). */
  | { kind: "results" };

/**
 * Picks the quiz screen from the event's flow, the quiz's progress and the
 * questions the viewer can read. A question the viewer can't read yet keeps
 * the screen loading; a revealed one whose key can't be read yet stays open.
 */
export function quizScreen(
  flow: QuizFlow,
  progress: QuizProgress | null,
  questions: QuizQuestionView[],
): QuizScreen {
  if (!progress) return { kind: "loading" };
  const step = flow.current_step;
  if (step >= progress.total) return { kind: "results" };
  const counter = { number: step + 1, total: progress.total };
  if (flow.phase !== "open" && flow.phase !== "revealed") {
    return { kind: "idle", ...counter };
  }
  const question = questions.find((q) => q.position === step);
  if (!question) return { kind: "loading" };
  if (flow.phase === "revealed" && question.correct !== null) {
    return {
      kind: "revealed",
      ...counter,
      question,
      correct: question.correct,
    };
  }
  return { kind: "open", ...counter, question };
}

/** The control panel's one button: the move it makes and its label. */
export type HostNextMove = {
  move: "open" | "reveal" | "next_step";
  labelKey:
    | "modules.quiz.run.open"
    | "modules.quiz.run.reveal"
    | "modules.quiz.run.next"
    | "modules.quiz.run.results";
};

/**
 * What the one button does next while the quiz runs, or null when it has
 * nothing to do (the quiz isn't running, or it is on the results step).
 */
export function hostNextMove(
  flow: QuizFlow,
  total: number,
): HostNextMove | null {
  if (flow.current_module !== "quiz" || flow.current_step >= total) {
    return null;
  }
  switch (flow.phase) {
    case "open":
      return { move: "reveal", labelKey: "modules.quiz.run.reveal" };
    case "revealed":
      return {
        move: "next_step",
        labelKey:
          flow.current_step + 1 >= total
            ? "modules.quiz.run.results"
            : "modules.quiz.run.next",
      };
    default:
      return { move: "open", labelKey: "modules.quiz.run.open" };
  }
}
