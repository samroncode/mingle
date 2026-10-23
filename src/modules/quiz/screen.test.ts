import { describe, expect, it } from "vitest";
import type { QuizQuestionView } from "@/api/quiz";
import { hostNextMove, quizScreen } from "./screen";

const question: QuizQuestionView = {
  id: "q3",
  position: 2,
  text: "Capital of Australia?",
  options: ["Sydney", "Melbourne", "Canberra", "Perth"],
  correct: null,
  answerCount: 0,
  played: false,
};
const progress = { total: 10, played: 2 };

function flow(current_step: number, phase: string) {
  return { current_module: "quiz", current_step, phase };
}

describe("quizScreen", () => {
  it("waits while the progress is unknown", () => {
    expect(quizScreen(flow(2, "idle"), null, [])).toEqual({ kind: "loading" });
  });

  it("says which question comes next while the step is idle", () => {
    expect(quizScreen(flow(2, "idle"), progress, [])).toEqual({
      kind: "idle",
      number: 3,
      total: 10,
    });
  });

  it("shows the question once it is open", () => {
    expect(quizScreen(flow(2, "open"), progress, [question])).toEqual({
      kind: "open",
      number: 3,
      total: 10,
      question,
    });
  });

  it("shows the right option once revealed", () => {
    const revealed = { ...question, correct: 2 };
    expect(quizScreen(flow(2, "revealed"), progress, [revealed])).toEqual({
      kind: "revealed",
      number: 3,
      total: 10,
      question: revealed,
      correct: 2,
    });
  });

  it("keeps the question without a right option until its key can be read", () => {
    expect(quizScreen(flow(2, "revealed"), progress, [question]).kind).toBe(
      "open",
    );
  });

  it("waits for an open question it hasn't read yet", () => {
    const earlier = { ...question, position: 1 };
    expect(quizScreen(flow(2, "open"), progress, [earlier])).toEqual({
      kind: "loading",
    });
  });

  it("shows the results after the last question", () => {
    expect(quizScreen(flow(10, "idle"), progress, [])).toEqual({
      kind: "results",
    });
  });
});

describe("hostNextMove", () => {
  it("opens an idle question", () => {
    expect(hostNextMove(flow(0, "idle"), 10)).toEqual({
      move: "open",
      labelKey: "modules.quiz.run.open",
    });
  });

  it("reveals an open question", () => {
    expect(hostNextMove(flow(0, "open"), 10)).toEqual({
      move: "reveal",
      labelKey: "modules.quiz.run.reveal",
    });
  });

  it("moves on after a reveal", () => {
    expect(hostNextMove(flow(8, "revealed"), 10)).toEqual({
      move: "next_step",
      labelKey: "modules.quiz.run.next",
    });
  });

  it("shows the results after the last question's reveal", () => {
    expect(hostNextMove(flow(9, "revealed"), 10)).toEqual({
      move: "next_step",
      labelKey: "modules.quiz.run.results",
    });
  });

  it("has no next move on the results step", () => {
    expect(hostNextMove(flow(10, "idle"), 10)).toBeNull();
  });

  it("has no next move while the quiz isn't running", () => {
    expect(
      hostNextMove({ ...flow(0, "idle"), current_module: null }, 10),
    ).toBeNull();
  });
});
