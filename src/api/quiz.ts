import { getSupabase } from "./client";
import {
  fail,
  ok,
  toAnswerErrorCode,
  type AnswerErrorCode,
  type Result,
} from "./errors";
import type { AppClient } from "./session";

/** A quiz question as the host reads it, with its right option. */
export interface QuizQuestionView {
  id: string;
  /** 0-based place in the quiz. */
  position: number;
  text: string;
  options: string[];
  /** Index (0-3) of the right option; null if the viewer can't read it yet. */
  correct: number | null;
  /** How many guests have answered; changed answers aren't counted twice. */
  answerCount: number;
}

/** How far the quiz has come: approved questions, and how many are played. */
export interface QuizProgress {
  total: number;
  played: number;
}

/**
 * The quiz's progress, for any member of the event. A non-member, an unknown
 * id and an expired event all get `not_found`.
 */
export async function getQuizProgress(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<QuizProgress, "not_found" | "unknown">> {
  const { data, error } = await client.rpc("quiz_progress", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  const row = data[0];
  return row ? ok({ total: row.total, played: row.played }) : fail("not_found");
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
    .select(
      "id, position, text, options, answer_count, quiz_answer_keys(correct)",
    )
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
      answerCount: row.answer_count,
    })),
  );
}

/**
 * Saves the guest's answer to a question, or changes the one they gave. A
 * refusal from the database (the question isn't open any more, or isn't the
 * quiz's current one) is `question_closed`.
 */
export async function answerQuizQuestion(
  answer: {
    eventId: string;
    questionId: string;
    userId: string;
    /** Index (0-3) of the chosen option. */
    chosen: number;
  },
  client: AppClient = getSupabase(),
): Promise<Result<null, AnswerErrorCode>> {
  const { eventId, questionId, userId, chosen } = answer;
  const change = () =>
    client
      .from("quiz_answers")
      .update({ chosen })
      .eq("question_id", questionId)
      .eq("user_id", userId)
      .select("chosen");

  const changed = await change();
  if (changed.error) return fail(toAnswerErrorCode(changed.error));
  if (changed.data.length > 0) return ok(null);

  // No row to change: either no answer yet, or the question is closed and the
  // policy hides the row from the update. Insert tells the two apart.
  const inserted = await client.from("quiz_answers").insert({
    question_id: questionId,
    event_id: eventId,
    user_id: userId,
    chosen,
  });
  if (!inserted.error) return ok(null);
  if (inserted.error.code === "23505") {
    // Two taps raced: the other one inserted first, so change it.
    const retry = await change();
    if (retry.error) return fail(toAnswerErrorCode(retry.error));
    return retry.data.length > 0 ? ok(null) : fail("question_closed");
  }
  return fail(toAnswerErrorCode(inserted.error));
}

/** The option the guest chose for a question, or null if they haven't answered. */
export async function getMyQuizAnswer(
  questionId: string,
  userId: string,
  client: AppClient = getSupabase(),
): Promise<Result<number | null, "unknown">> {
  const { data, error } = await client
    .from("quiz_answers")
    .select("chosen")
    .eq("question_id", questionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return fail("unknown");
  return ok(data?.chosen ?? null);
}

/**
 * The ids of the guests who have answered a question, never what they chose.
 * Only the host reads other guests' rows; a guest gets at most their own id.
 */
export async function listQuizAnswerers(
  questionId: string,
  client: AppClient = getSupabase(),
): Promise<Result<string[], "unknown">> {
  const { data, error } = await client
    .from("quiz_answers")
    .select("user_id")
    .eq("question_id", questionId);
  if (error) return fail("unknown");
  return ok(data.map((row) => row.user_id));
}

/**
 * How many guests picked each option (index 0-3) of a revealed question.
 * Nothing before the reveal or for a non-member, so that is `not_revealed`.
 */
export async function getQuizVotes(
  questionId: string,
  client: AppClient = getSupabase(),
): Promise<Result<number[], "not_revealed" | "unknown">> {
  const { data, error } = await client.rpc("quiz_votes", {
    target_question_id: questionId,
  });
  if (error) return fail("unknown");
  if (data.length === 0) return fail("not_revealed");
  const votes = [0, 0, 0, 0];
  for (const row of data) votes[row.option] = row.votes;
  return ok(votes);
}

/** One guest's score in the quiz, with the place ties share (1, 1, 3). */
export interface QuizScore {
  userId: string;
  displayName: string;
  /** One point per right answer on played questions. */
  score: number;
  place: number;
}

/**
 * The guests' scores, best first, as the viewer may read them: the host gets
 * every guest, a guest their own row and (once the quiz is finished) the top
 * 3 places, the TV the top 3 places once finished. Scores of questions that
 * aren't played yet are never counted.
 */
export async function getQuizScores(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<QuizScore[], "unknown">> {
  const { data, error } = await client.rpc("quiz_scores", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      score: row.score,
      place: row.place,
    })),
  );
}

/** Answers arrive in bursts; one refetch per this long is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a question or an answer of
 * the event changes, such as a new answer counting on its question. Changes
 * are only a signal to refetch, so RLS applies to every read. Returns a
 * function that stops it.
 */
export function subscribeToQuizChanges(
  eventId: string,
  onChange: () => void,
  client: AppClient = getSupabase(),
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const signal = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, CHANGE_DELAY_MS);
  };
  // A random suffix: two views of one event must not share a channel.
  const channel = client
    .channel(`quiz:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "quiz_questions",
        filter: `event_id=eq.${eventId}`,
      },
      signal,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "quiz_answers",
        filter: `event_id=eq.${eventId}`,
      },
      signal,
    )
    .subscribe();
  return () => {
    clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
