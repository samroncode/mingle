import type { Language } from "@/i18n/language";
import {
  QuizQuestionSchema,
  quizLimits,
  type QuizQuestion,
} from "@/lib/schemas/quiz";
import { getNiche, type NicheId } from "@/niches";
import {
  emptyPickList,
  pickDefaultIds,
  pickListReducer,
  resetBuiltinItems,
  type OwnItem,
  type PickItem,
  type PickList,
  type PickListAction,
  type PickListRules,
} from "./pick-list";

/** How many of the niche's questions are picked for the host to start from. */
export const defaultQuizSize = 10;

export type QuizOptions = [string, string, string, string];

/** The fields of a question the host wrote, as typed: they may be unfinished. */
export interface OwnQuestionFields {
  text: string;
  options: QuizOptions;
  /** Index (0-3) of the right option. */
  correct: number;
}

/** A question the host wrote; the key tells it apart across edits and moves. */
export type OwnQuestion = OwnItem<OwnQuestionFields>;

/** One question in the quiz, in the order it will be played. */
export type QuizItem = PickItem<OwnQuestionFields>;

/** The quiz as the host has built it so far. */
export type QuizDraft = PickList<OwnQuestionFields>;

export const emptyQuiz: QuizDraft = emptyPickList();

export type QuizAction = PickListAction<OwnQuestionFields>;

const quizRules: PickListRules<OwnQuestionFields> = {
  limit: quizLimits.questions,
  blank: () => ({ text: "", options: ["", "", "", ""], correct: 0 }),
};

/** Picks `size` of the niche's questions at random; `random` is injectable. */
export function pickDefaultQuizIds(
  niche: NicheId,
  random: () => number = Math.random,
  size: number = defaultQuizSize,
): string[] {
  const ids = getNiche(niche).quiz.map((question) => question.id);
  return pickDefaultIds(ids, size, random);
}

export const resetBuiltinQuiz = resetBuiltinItems<OwnQuestionFields>;

export function quizReducer(quiz: QuizDraft, action: QuizAction): QuizDraft {
  return pickListReducer(quiz, action, quizRules);
}

function toQuestion(own: OwnQuestion): QuizQuestion {
  return {
    text: own.text.trim(),
    options: own.options.map((option) => option.trim()) as QuizOptions,
    correct: own.correct,
  };
}

/**
 * The questions as the request carries them, in order: built-in ones copied
 * in the event language, the host's own trimmed. A built-in id the niche no
 * longer has is left out.
 */
export function toQuizQuestions(
  niche: NicheId,
  language: Language,
  quiz: QuizDraft,
): QuizQuestion[] {
  const builtin = new Map(getNiche(niche).quiz.map((q) => [q.id, q]));
  return quiz.items.flatMap((item): QuizQuestion[] => {
    if (item.kind === "own") return [toQuestion(item)];
    const content = builtin.get(item.id);
    return content
      ? [{ ...content.texts[language], correct: content.correct }]
      : [];
  });
}

/** Keys of the host's own questions that break the shared question schema. */
export function invalidOwnKeys(quiz: QuizDraft): string[] {
  return quiz.items.flatMap((item) =>
    item.kind === "own" &&
    !QuizQuestionSchema.safeParse(toQuestion(item)).success
      ? [item.key]
      : [],
  );
}
