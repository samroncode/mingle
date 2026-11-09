import type { EventRow } from "@/api/events";
import {
  getQuizProgress,
  listQuizQuestions,
  subscribeToQuizChanges,
  type QuizProgress,
  type QuizQuestionView,
} from "@/api/quiz";
import { useModuleRun, type ModuleRunSource } from "@/hooks/useModuleRun";

/** The data a running quiz' views render, as the viewer may read it. */
export type QuizRunState = {
  progress: QuizProgress | null;
  questions: QuizQuestionView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them can read again. */
  version: number;
};

const source: ModuleRunSource<QuizProgress, QuizQuestionView> = {
  readProgress: getQuizProgress,
  readItems: listQuizQuestions,
  subscribe: subscribeToQuizChanges,
};

/** Reads the progress and the questions the viewer can read; see `useModuleRun`. */
export function useQuizRun(event: EventRow): QuizRunState {
  const { items, ...rest } = useModuleRun(event, source);
  return { ...rest, questions: items };
}
