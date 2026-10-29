import { listQuizAnswerers } from "@/api/quiz";
import { useLoad } from "@/hooks/useLoad";

/**
 * The ids of the guests who have answered a question, read again whenever
 * `version` changes (the quiz data was read again). Only the host gets other
 * guests' ids. A failed read keeps the last list.
 */
export function useQuizAnswerers(
  questionId: string | undefined,
  version: number,
): string[] {
  const state = useLoad(
    questionId ?? "",
    () => listQuizAnswerers(questionId ?? ""),
    { enabled: !!questionId, refresh: version, keepOnError: true },
  );
  return state.status === "ready" ? state.value : [];
}
