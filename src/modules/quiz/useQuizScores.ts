import { useEffect, useState } from "react";
import { getQuizScores, type QuizScore } from "@/api/quiz";

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
  const [loaded, setLoaded] = useState<{
    eventId: string;
    scores: QuizScore[];
  }>();

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    void getQuizScores(eventId).then((result) => {
      if (stale || !result.ok) return;
      setLoaded({ eventId, scores: result.value });
    });
    return () => {
      stale = true;
    };
  }, [eventId, enabled, refresh]);

  return loaded?.eventId === eventId ? loaded.scores : null;
}
