// Shared with the host-actions Edge Function, which imports this file by
// relative path under Deno: only `zod` and relative imports with a `.ts`
// extension, and no browser or Node APIs.
import { z } from "zod";

/** The limits of a quiz question; the wizard and host-actions use them too. */
export const quizLimits = {
  question: 200,
  option: 80,
  options: 4,
  /** Questions in one quiz. */
  questions: 30,
} as const;

const text = (max: number) => z.string().trim().min(1).max(max);

/** One quiz question: four options and the index (0-3) of the right one. */
export const QuizQuestionSchema = z.strictObject({
  text: text(quizLimits.question),
  options: z.tuple([
    text(quizLimits.option),
    text(quizLimits.option),
    text(quizLimits.option),
    text(quizLimits.option),
  ]),
  correct: z.number().int().min(0).max(3),
});

export const QuizQuestionsSchema = z
  .array(QuizQuestionSchema)
  .max(quizLimits.questions);

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
