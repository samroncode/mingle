import { useEffect, useState } from "react";
import { listQuizAnswerers } from "@/api/quiz";

/**
 * The ids of the guests who have answered a question, read again whenever
 * `version` changes (the quiz data was read again). Only the host gets other
 * guests' ids. A failed read keeps the last list.
 */
export function useQuizAnswerers(
  questionId: string | undefined,
  version: number,
): string[] {
  const [loaded, setLoaded] = useState<{ questionId?: string; ids: string[] }>({
    ids: [],
  });

  useEffect(() => {
    if (!questionId) return;
    let stale = false;
    void listQuizAnswerers(questionId).then((result) => {
      if (stale || !result.ok) return;
      setLoaded({ questionId, ids: result.value });
    });
    return () => {
      stale = true;
    };
  }, [questionId, version]);

  return loaded.questionId === questionId ? loaded.ids : [];
}
