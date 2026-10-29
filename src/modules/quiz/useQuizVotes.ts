import { getQuizVotes } from "@/api/quiz";
import { useLoad } from "@/hooks/useLoad";

/**
 * How many guests picked each option of a question, once it is revealed; null
 * until then or while the first read is in flight. A failed read keeps the
 * last counts.
 */
export function useQuizVotes(
  questionId: string | undefined,
  revealed: boolean,
): number[] | null {
  const state = useLoad(
    questionId ?? "",
    () => getQuizVotes(questionId ?? ""),
    { enabled: !!questionId && revealed, keepOnError: true },
  );
  return revealed && state.status === "ready" ? state.value : null;
}
