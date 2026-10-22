import type { Language } from "@/i18n/language";
import {
  QuizQuestionSchema,
  quizLimits,
  type QuizQuestion,
} from "@/lib/schemas/quiz";
import { getNiche, type NicheId } from "@/niches";

/** How many of the niche's questions are picked for the host to start from. */
export const defaultQuizSize = 10;

export type QuizOptions = [string, string, string, string];

/** A question the host wrote, as typed: it may be empty or unfinished. */
export interface OwnQuestion {
  /** Tells own questions apart across edits and moves; never sent. */
  key: string;
  text: string;
  options: QuizOptions;
  /** Index (0-3) of the right option. */
  correct: number;
}

/** One question in the quiz, in the order it will be played. */
export type QuizItem =
  { kind: "builtin"; id: string } | ({ kind: "own" } & OwnQuestion);

/**
 * The quiz as the host has built it so far. Built-in questions are kept by
 * id, so they follow the event language. Plain data, so it can be saved as
 * JSON.
 */
export interface QuizDraft {
  /** False until the default pick has been made, which happens only once. */
  seeded: boolean;
  items: QuizItem[];
}

export const emptyQuiz: QuizDraft = { seeded: false, items: [] };

export type QuizAction =
  | { type: "seed"; ids: string[] }
  | { type: "add_builtin"; id: string }
  | { type: "add_own"; key: string }
  | {
      type: "edit_own";
      key: string;
      change: Partial<Omit<OwnQuestion, "key">>;
    }
  | { type: "move"; from: number; to: number }
  | { type: "remove"; index: number };

/** Picks `size` of the niche's questions at random; `random` is injectable. */
export function pickDefaultQuizIds(
  niche: NicheId,
  random: () => number = Math.random,
  size: number = defaultQuizSize,
): string[] {
  const ids = getNiche(niche).quiz.map((question) => question.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = ids[i];
    ids[i] = ids[j] as string;
    ids[j] = swap as string;
  }
  return ids.slice(0, size);
}

function ownItems(quiz: QuizDraft): QuizItem[] {
  return quiz.items.filter((item) => item.kind === "own");
}

/**
 * After the niche changed: the old niche's questions no longer exist, so they
 * go, and the default pick is made again when the step is next reached. The
 * host's own questions stay.
 */
export function resetBuiltinQuiz(quiz: QuizDraft): QuizDraft {
  return { seeded: false, items: ownItems(quiz) };
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

const full = (quiz: QuizDraft) => quiz.items.length >= quizLimits.questions;

export function quizReducer(quiz: QuizDraft, action: QuizAction): QuizDraft {
  switch (action.type) {
    case "seed": {
      if (quiz.seeded) return quiz;
      const picked: QuizItem[] = action.ids.map((id) => ({
        kind: "builtin",
        id,
      }));
      return {
        seeded: true,
        items: [...picked, ...ownItems(quiz)].slice(0, quizLimits.questions),
      };
    }
    case "add_builtin": {
      const present = quiz.items.some(
        (item) => item.kind === "builtin" && item.id === action.id,
      );
      if (present || full(quiz)) return quiz;
      return {
        ...quiz,
        items: [...quiz.items, { kind: "builtin", id: action.id }],
      };
    }
    case "add_own":
      if (full(quiz)) return quiz;
      return {
        ...quiz,
        items: [
          ...quiz.items,
          {
            kind: "own",
            key: action.key,
            text: "",
            options: ["", "", "", ""],
            correct: 0,
          },
        ],
      };
    case "edit_own":
      return {
        ...quiz,
        items: quiz.items.map((item) =>
          item.kind === "own" && item.key === action.key
            ? { ...item, ...action.change }
            : item,
        ),
      };
    case "move":
      return { ...quiz, items: moveItem(quiz.items, action.from, action.to) };
    case "remove":
      return {
        ...quiz,
        items: quiz.items.filter((_, index) => index !== action.index),
      };
  }
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
