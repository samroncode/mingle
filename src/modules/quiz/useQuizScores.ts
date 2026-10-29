import { getQuizScores, type QuizScore } from "@/api/quiz";
import { useLoad } from "@/hooks/useLoad";

/**
 * The scores the viewer may read, best first; null until the first read. Reads
 * again whenever `refresh` changes (the quiz data was read again after a flow
 * move or a new answer). A failed read keeps the last scores. Does nothing
 * while `enabled` is false.
 */
export function useQuizScores(
  eventId: string,
  enabled: boolean,
  refresh: number,
): QuizScore[] | null {
  const state = useLoad(eventId, () => getQuizScores(eventId), {
    enabled,
    refresh,
    keepOnError: true,
  });
  return state.status === "ready" ? state.value : null;
}
