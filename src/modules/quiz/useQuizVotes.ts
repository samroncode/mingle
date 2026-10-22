import { useEffect, useState } from "react";
import { getQuizVotes } from "@/api/quiz";

/**
 * How many guests picked each option of a question, once it is revealed; null
 * until then or while the first read is in flight. A failed read keeps the
 * last counts.
 */
export function useQuizVotes(
  questionId: string | undefined,
  revealed: boolean,
): number[] | null {
  const [loaded, setLoaded] = useState<{
    questionId?: string;
    votes: number[];
  }>({ votes: [] });

  useEffect(() => {
    if (!questionId || !revealed) return;
    let stale = false;
    void getQuizVotes(questionId).then((result) => {
      if (stale || !result.ok) return;
      setLoaded({ questionId, votes: result.value });
    });
    return () => {
      stale = true;
    };
  }, [questionId, revealed]);

  return revealed && loaded.questionId === questionId ? loaded.votes : null;
}
