import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

/** A quiz question as the host reads it, with its right option. */
export interface QuizQuestionView {
  id: string;
  /** 0-based place in the quiz. */
  position: number;
  text: string;
  options: string[];
  /** Index (0-3) of the right option; null if the host can't read it. */
  correct: number | null;
}

/**
 * The event's quiz questions in order, with their right options. A host
 * reads all of them; anyone else only gets what RLS lets them read, which
 * never includes a right answer before its reveal.
 */
export async function listQuizQuestions(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<QuizQuestionView[], "unknown">> {
  const { data, error } = await client
    .from("quiz_questions")
    .select("id, position, text, options, quiz_answer_keys(correct)")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      position: row.position,
      text: row.text,
      options: row.options,
      correct: row.quiz_answer_keys?.correct ?? null,
    })),
  );
}
