import { useEffect, useState } from "react";
import type { EventRow } from "@/api/events";
import {
  getQuizProgress,
  listQuizQuestions,
  subscribeToQuizChanges,
  type QuizProgress,
  type QuizQuestionView,
} from "@/api/quiz";

/** The quiz data a running quiz's views render, as the viewer may read it. */
export type QuizRunState = {
  progress: QuizProgress | null;
  questions: QuizQuestionView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Grows each time the data was read again, for hooks that follow it. */
  version: number;
};

const empty: QuizRunState = {
  progress: null,
  questions: [],
  failed: false,
  version: 0,
};

/**
 * Reads the quiz's progress and the questions the viewer can read, again on
 * every new event snapshot (each flow move, and each reconnect) and when a
 * question or answer changes (a new answer counts on its question). A failed
 * read keeps the last data, so a TV doesn't go blank during a network drop.
 */
export function useQuizRun(event: EventRow): QuizRunState {
  const [loaded, setLoaded] = useState({ eventId: event.id, state: empty });
  const [changes, setChanges] = useState(0);

  useEffect(
    () => subscribeToQuizChanges(event.id, () => setChanges((n) => n + 1)),
    [event.id],
  );

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
          return {
            eventId: event.id,
            state: { ...last, failed: true, version: last.version + 1 },
          };
        }
        return {
          eventId: event.id,
          state: {
            progress: progress.value,
            questions: questions.value,
            failed: false,
            version: last.version + 1,
          },
        };
      });
    });
    return () => {
      stale = true;
    };
  }, [event, changes]);

  return loaded.eventId === event.id ? loaded.state : empty;
}
