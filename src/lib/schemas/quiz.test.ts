import { describe, expect, it } from "vitest";
import { QuizQuestionSchema, QuizQuestionsSchema, quizLimits } from "./quiz";

const question = {
  text: "Which planet is closest to the sun?",
  options: ["Mercury", "Venus", "Earth", "Mars"],
  correct: 0,
};

describe("QuizQuestionSchema", () => {
  it("accepts a question with four options", () => {
    expect(QuizQuestionSchema.safeParse(question).success).toBe(true);
  });

  it("rejects empty or too long text", () => {
    for (const text of ["", "   ", "x".repeat(quizLimits.question + 1)]) {
      expect(QuizQuestionSchema.safeParse({ ...question, text }).success).toBe(
        false,
      );
    }
    const longest = "x".repeat(quizLimits.question);
    expect(
      QuizQuestionSchema.safeParse({ ...question, text: longest }).success,
    ).toBe(true);
  });

  it("rejects options that are not exactly four, empty or too long", () => {
    const options = question.options;
    for (const bad of [
      options.slice(0, 3),
      [...options, "Jupiter"],
      ["Mercury", "", "Earth", "Mars"],
      ["Mercury", "x".repeat(quizLimits.option + 1), "Earth", "Mars"],
    ]) {
      expect(
        QuizQuestionSchema.safeParse({ ...question, options: bad }).success,
      ).toBe(false);
    }
  });

  it("only accepts a right option from 0 to 3", () => {
    for (const correct of [-1, 4, 1.5]) {
      expect(
        QuizQuestionSchema.safeParse({ ...question, correct }).success,
      ).toBe(false);
    }
    expect(
      QuizQuestionSchema.safeParse({ ...question, correct: 3 }).success,
    ).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(
      QuizQuestionSchema.safeParse({ ...question, extra: true }).success,
    ).toBe(false);
  });
});

describe("QuizQuestionsSchema", () => {
  it("allows at most 30 questions", () => {
    const many = (n: number) => Array.from({ length: n }, () => question);
    expect(QuizQuestionsSchema.safeParse(many(30)).success).toBe(true);
    expect(QuizQuestionsSchema.safeParse(many(31)).success).toBe(false);
  });
});
