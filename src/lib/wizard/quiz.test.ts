import { describe, expect, it } from "vitest";
import { QuizQuestionsSchema, quizLimits } from "@/lib/schemas/quiz";
import { getNiche } from "@/niches";
import { nicheIds } from "@/niches/ids";
import {
  defaultQuizSize,
  emptyQuiz,
  invalidOwnKeys,
  pickDefaultQuizIds,
  quizReducer,
  resetBuiltinQuiz,
  toQuizQuestions,
  type QuizAction,
  type QuizDraft,
} from "./quiz";

function run(quiz: QuizDraft, ...actions: QuizAction[]) {
  return actions.reduce(quizReducer, quiz);
}

const niche = nicheIds[0];
const ids = (quiz: QuizDraft) =>
  quiz.items.map((item) => (item.kind === "builtin" ? item.id : item.key));

/** A random source that counts up, so a pick is repeatable. */
function counter() {
  let n = 0;
  return () => (n++ % 7) / 7;
}

describe("pickDefaultQuizIds", () => {
  it.each(nicheIds)("picks ten different questions of the %s niche", (id) => {
    const picked = pickDefaultQuizIds(id);
    const known = new Set(getNiche(id).quiz.map((q) => q.id));
    expect(picked).toHaveLength(defaultQuizSize);
    expect(new Set(picked).size).toBe(defaultQuizSize);
    expect(picked.every((pick) => known.has(pick))).toBe(true);
  });

  it("is a different pick for a different random source", () => {
    const first = pickDefaultQuizIds(niche, () => 0);
    const second = pickDefaultQuizIds(niche, () => 0.999);
    expect(first).not.toEqual(second);
  });

  it("is repeatable for the same random source", () => {
    expect(pickDefaultQuizIds(niche, counter())).toEqual(
      pickDefaultQuizIds(niche, counter()),
    );
  });
});

describe("seed", () => {
  it("fills the quiz with the picked questions, once", () => {
    const seeded = run(emptyQuiz, { type: "seed", ids: ["a-1", "a-2"] });
    expect(seeded).toEqual({
      seeded: true,
      items: [
        { kind: "builtin", id: "a-1" },
        { kind: "builtin", id: "a-2" },
      ],
    });
    expect(run(seeded, { type: "seed", ids: ["b-1"] })).toBe(seeded);
  });

  it("puts the host's own questions after the picked ones", () => {
    const quiz = run(
      emptyQuiz,
      { type: "add_own", key: "k1" },
      { type: "seed", ids: ["a-1"] },
    );
    expect(ids(quiz)).toEqual(["a-1", "k1"]);
  });
});

describe("editing the quiz", () => {
  const seeded = run(emptyQuiz, { type: "seed", ids: ["a-1", "a-2", "a-3"] });

  it("removes a question and adds a ready-made one back at the end", () => {
    const quiz = run(
      seeded,
      { type: "remove", index: 0 },
      { type: "add_builtin", id: "a-1" },
    );
    expect(ids(quiz)).toEqual(["a-2", "a-3", "a-1"]);
  });

  it("does not add the same ready-made question twice", () => {
    expect(run(seeded, { type: "add_builtin", id: "a-2" })).toBe(seeded);
  });

  it("moves a question", () => {
    const quiz = run(seeded, { type: "move", from: 2, to: 0 });
    expect(ids(quiz)).toEqual(["a-3", "a-1", "a-2"]);
  });

  it("adds, edits and removes the host's own question", () => {
    const quiz = run(
      seeded,
      { type: "add_own", key: "k" },
      {
        type: "edit_own",
        key: "k",
        change: { text: "Q?", options: ["a", "b", "c", "d"], correct: 3 },
      },
    );
    expect(quiz.items.at(-1)).toEqual({
      kind: "own",
      key: "k",
      text: "Q?",
      options: ["a", "b", "c", "d"],
      correct: 3,
    });
    expect(ids(run(quiz, { type: "remove", index: 3 }))).toEqual([
      "a-1",
      "a-2",
      "a-3",
    ]);
  });

  it("stops at 30 questions", () => {
    const many = run(emptyQuiz, {
      type: "seed",
      ids: Array.from({ length: quizLimits.questions }, (_, i) => `a-${i}`),
    });
    expect(many.items).toHaveLength(30);
    expect(run(many, { type: "add_own", key: "k" })).toBe(many);
    expect(run(many, { type: "add_builtin", id: "b-1" })).toBe(many);
  });
});

describe("resetBuiltinQuiz", () => {
  it("drops the ready-made questions, keeps the host's own and picks again later", () => {
    const quiz = run(
      emptyQuiz,
      { type: "seed", ids: ["a-1"] },
      { type: "add_own", key: "k" },
    );
    const reset = resetBuiltinQuiz(quiz);
    expect(reset.seeded).toBe(false);
    expect(ids(reset)).toEqual(["k"]);
  });
});

describe("toQuizQuestions", () => {
  it("copies ready-made questions in the event language and keeps the order", () => {
    const [first, second] = getNiche(niche).quiz;
    if (!first || !second) throw new Error("niche has no quiz content");
    const quiz = run(emptyQuiz, { type: "seed", ids: [second.id, first.id] });
    const sv = toQuizQuestions(niche, "sv", quiz);
    const en = toQuizQuestions(niche, "en", quiz);
    expect(sv).toEqual([
      { ...second.texts.sv, correct: second.correct },
      { ...first.texts.sv, correct: first.correct },
    ]);
    expect(en[0]).toEqual({ ...second.texts.en, correct: second.correct });
    expect(QuizQuestionsSchema.safeParse(sv).success).toBe(true);
  });

  it("trims the host's own questions and leaves out an unknown ready-made id", () => {
    const quiz = run(
      emptyQuiz,
      { type: "seed", ids: ["gone-1"] },
      { type: "add_own", key: "k" },
      {
        type: "edit_own",
        key: "k",
        change: { text: " Q? ", options: [" a", "b ", "c", "d"], correct: 1 },
      },
    );
    expect(toQuizQuestions(niche, "en", quiz)).toEqual([
      { text: "Q?", options: ["a", "b", "c", "d"], correct: 1 },
    ]);
  });
});

describe("invalidOwnKeys", () => {
  it("flags own questions with a blank text or option, not ready-made ones", () => {
    const quiz = run(
      emptyQuiz,
      { type: "seed", ids: ["a-1"] },
      { type: "add_own", key: "empty" },
      { type: "add_own", key: "good" },
      {
        type: "edit_own",
        key: "good",
        change: { text: "Q?", options: ["a", "b", "c", "d"] },
      },
      { type: "add_own", key: "blank-option" },
      {
        type: "edit_own",
        key: "blank-option",
        change: { text: "Q?", options: ["a", " ", "c", "d"] },
      },
    );
    expect(invalidOwnKeys(quiz)).toEqual(["empty", "blank-option"]);
  });
});
