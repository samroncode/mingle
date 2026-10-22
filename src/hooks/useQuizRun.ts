import { useEffect, useState } from "react";
import type { EventRow } from "@/api/events";
import {
  getQuizProgress,
  listQuizQuestions,
  type QuizProgress,
  type QuizQuestionView,
} from "@/api/quiz";

/** The quiz data a running quiz's views render, as the viewer may read it. */
export type QuizRunState = {
  progress: QuizProgress | null;
  questions: QuizQuestionView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
};

const empty: QuizRunState = { progress: null, questions: [], failed: false };

/**
 * Reads the quiz's progress and the questions the viewer can read, again on
 * every new event snapshot (each flow move, and each reconnect). A failed
 * read keeps the last data, so a TV doesn't go blank during a network drop.
 */
export function useQuizRun(event: EventRow): QuizRunState {
  const [loaded, setLoaded] = useState({ eventId: event.id, state: empty });

  useEffect(() => {
    let stale = false;
    void Promise.all([
      getQuizProgress(event.id),
      listQuizQuestions(event.id),
    ]).then(([progress, questions]) => {
      if (stale) return;
      setLoaded((previous) => {
        const last = previous.eventId === event.id ? previous.state : empty;
        if (!progress.ok || !questions.ok) {
          return { eventId: event.id, state: { ...last, failed: true } };
        }
        return {
          eventId: event.id,
          state: {
            progress: progress.value,
            questions: questions.value,
            failed: false,
          },
        };
      });
    });
    return () => {
      stale = true;
    };
  }, [event]);

  return loaded.eventId === event.id ? loaded.state : empty;
}
