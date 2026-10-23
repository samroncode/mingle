import type { HostActionError, HostActionResult } from "@/api/host-actions";
import type { QuizProgress, QuizQuestionView } from "@/api/quiz";
import type { Language } from "@/i18n/language";
import type { UpdateQuizResponse } from "@/lib/schemas/host-actions";
import type { QuizQuestion } from "@/lib/schemas/quiz";
import {
  invalidOwnKeys,
  toQuizQuestions,
  type QuizDraft,
  type QuizItem,
  type QuizOptions,
} from "@/lib/wizard/quiz";
import { getNiche, type NicheId } from "@/niches";
import { hostPanelErrorKey } from "./host-panel";

/** The event's quiz split for the control panel's editor. */
export interface QuizEdit {
  /** Played questions, shown locked before the list. */
  played: QuizQuestionView[];
  /** The unplayed questions as the wizard's quiz editor edits them. */
  draft: QuizDraft;
  /** Ready-made questions already played, so they aren't offered again. */
  hiddenIds: string[];
}

function sameQuestion(
  question: QuizQuestionView,
  ready: QuizQuestion,
): boolean {
  return (
    question.text === ready.text &&
    question.correct === ready.correct &&
    question.options.length === ready.options.length &&
    question.options.every((option, i) => option === ready.options[i])
  );
}

/**
 * The event's questions as the editor shows them. A question that is a copy
 * of one of the niche's ready-made questions in the event language counts as
 * that one again, so the host can untick and tick it like in the wizard; any
 * other question is the host's own, keyed by its id.
 */
export function quizToDraft(
  niche: NicheId,
  language: Language,
  questions: QuizQuestionView[],
): QuizEdit {
  const ready = getNiche(niche).quiz.map((content) => ({
    id: content.id,
    question: { ...content.texts[language], correct: content.correct },
  }));
  const used = new Set<string>();
  const readyId = (question: QuizQuestionView) => {
    const match = ready.find(
      (r) => !used.has(r.id) && sameQuestion(question, r.question),
    );
    if (match) used.add(match.id);
    return match?.id;
  };

  const played = questions.filter((q) => q.played);
  const hiddenIds = played.flatMap((q) => readyId(q) ?? []);
  const items = questions
    .filter((q) => !q.played)
    .map((q): QuizItem => {
      const id = readyId(q);
      if (id) return { kind: "builtin", id };
      return {
        kind: "own",
        key: q.id,
        text: q.text,
        options: [...q.options] as QuizOptions,
        correct: q.correct ?? 0,
      };
    });
  return { played, draft: { seeded: true, items }, hiddenIds };
}

export type QuizSaveResult =
  | { ok: true }
  | { ok: false; invalid: string[] }
  | { ok: false; error: HostActionError };

type SendQuiz = (input: {
  code: string;
  key: string;
  questions: QuizQuestion[];
}) => Promise<HostActionResult<UpdateQuizResponse>>;

/**
 * Checks the host's own questions and sends the unplayed list, which replaces
 * the unplayed questions of the event. Played ones are never sent.
 */
export async function saveQuizEdit(
  niche: NicheId,
  language: Language,
  draft: QuizDraft,
  target: { code: string; key: string },
  send: SendQuiz,
): Promise<QuizSaveResult> {
  const invalid = invalidOwnKeys(draft);
  if (invalid.length > 0) return { ok: false, invalid };
  const result = await send({
    ...target,
    questions: toQuizQuestions(niche, language, draft),
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Whether the host may change the unplayed questions now: not while a
 * question is open or revealed, not once every question is played, and not
 * after the evening. host-actions checks the same.
 */
export function canEditQuiz(
  event: { status: string; current_module: string | null; phase: string },
  progress: QuizProgress,
): boolean {
  if (event.status === "ended") return false;
  if (event.current_module === "quiz" && event.phase !== "idle") return false;
  return !(progress.total > 0 && progress.played >= progress.total);
}

/** i18n key of the message for a failed quiz edit. */
export function quizEditErrorKey(error: HostActionError) {
  switch (error) {
    case "invalid_transition":
    case "module_disabled":
    case "invalid_request":
      return `modules.quiz.edit.errors.${error}` as const;
    case "payload_too_large":
      return "modules.quiz.edit.errors.invalid_request" as const;
    default:
      return hostPanelErrorKey(error);
  }
}
