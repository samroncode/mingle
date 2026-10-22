import { useEffect, useState } from "react";
import { listQuizQuestions, type QuizQuestionView } from "@/api/quiz";

export type QuizQuestionsState =
  | { status: "loading" }
  | { status: "ready"; questions: QuizQuestionView[] }
  | { status: "error" };

/** Loads the event's quiz questions once, when the component mounts. */
export function useQuizQuestions(eventId: string): QuizQuestionsState {
  const [loaded, setLoaded] = useState<{
    eventId: string;
    state: QuizQuestionsState;
  }>();

  useEffect(() => {
    let stale = false;
    void listQuizQuestions(eventId).then((result) => {
      if (stale) return;
      setLoaded({
        eventId,
        state: result.ok
          ? { status: "ready", questions: result.value }
          : { status: "error" },
      });
    });
    return () => {
      stale = true;
    };
  }, [eventId]);

  return loaded?.eventId === eventId ? loaded.state : { status: "loading" };
}
