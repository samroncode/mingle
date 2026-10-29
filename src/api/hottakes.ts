import { getSupabase } from "./client";
import {
  fail,
  ok,
  toAnswerErrorCode,
  type AnswerErrorCode,
  type Result,
} from "./errors";
import type { AppClient } from "./session";

/** A hot take as a member may read it. */
export interface HotTakeView {
  id: string;
  /** 0-based place in the hot takes. */
  position: number;
  text: string;
  /** How many guests have answered it. */
  answerCount: number;
  /** Revealed, so its result is known and it can't be changed any more. */
  revealed: boolean;
}

/**
 * The event's hot takes in order. A host reads all of them; anyone else only
 * gets what RLS lets them read: a hot take that is shown now or was revealed.
 */
export async function listHotTakes(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<HotTakeView[], "unknown">> {
  const { data, error } = await client
    .from("hot_takes")
    .select("id, position, text, answer_count, revealed_at")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      position: row.position,
      text: row.text,
      answerCount: row.answer_count,
      // The test fakes may leave the time out.
      revealed: Boolean(row.revealed_at),
    })),
  );
}

/** How far the hot takes have come: approved hot takes, and how many are revealed. */
export interface HotTakeProgress {
  total: number;
  revealed: number;
}

/**
 * The hot takes' progress, for any member of the event. A non-member, an
 * unknown id and an expired event all get `not_found`.
 */
export async function getHotTakeProgress(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<HotTakeProgress, "not_found" | "unknown">> {
  const { data, error } = await client.rpc("hot_take_progress", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  const row = data[0];
  return row
    ? ok({ total: row.total, revealed: row.revealed })
    : fail("not_found");
}

/**
 * Saves the guest's answer to a hot take, or changes the one they gave. A
 * refusal from the database (the hot take isn't open any more, or isn't the
 * current one) is `question_closed`.
 */
export async function answerHotTake(
  answer: {
    eventId: string;
    hotTakeId: string;
    guestId: string;
    agree: boolean;
  },
  client: AppClient = getSupabase(),
): Promise<Result<null, AnswerErrorCode>> {
  const { eventId, hotTakeId, guestId, agree } = answer;
  const change = () =>
    client
      .from("hot_take_answers")
      .update({ agree })
      .eq("hot_take_id", hotTakeId)
      .eq("guest_id", guestId)
      .select("agree");

  const changed = await change();
  if (changed.error) return fail(toAnswerErrorCode(changed.error));
  if (changed.data.length > 0) return ok(null);

  // No row to change: either no answer yet, or the hot take is closed and the
  // policy hides the row from the update. Insert tells the two apart.
  const inserted = await client.from("hot_take_answers").insert({
    hot_take_id: hotTakeId,
    event_id: eventId,
    guest_id: guestId,
    agree,
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

/** The guest's answer to a hot take (true = agree), or null if none yet. */
export async function getMyHotTakeAnswer(
  hotTakeId: string,
  guestId: string,
  client: AppClient = getSupabase(),
): Promise<Result<boolean | null, "unknown">> {
  const { data, error } = await client
    .from("hot_take_answers")
    .select("agree")
    .eq("hot_take_id", hotTakeId)
    .eq("guest_id", guestId)
    .maybeSingle();
  if (error) return fail("unknown");
  return ok(data?.agree ?? null);
}

/** How a revealed hot take went: the guests who agreed and who didn't. */
export interface HotTakeSplit {
  agree: number;
  disagree: number;
}

/**
 * The split of a revealed hot take, for any member. Null before the reveal,
 * for a draft and for a non-member.
 */
export async function getHotTakeResult(
  hotTakeId: string,
  client: AppClient = getSupabase(),
): Promise<Result<HotTakeSplit | null, "unknown">> {
  const { data, error } = await client.rpc("hot_take_result", {
    target_hot_take_id: hotTakeId,
  });
  if (error) return fail("unknown");
  const row = data[0];
  return ok(
    row ? { agree: row.agree_count, disagree: row.disagree_count } : null,
  );
}

/** A hot take picked out in the summary, with its split. */
export interface HotTakeHighlight extends HotTakeSplit {
  hotTakeId: string;
  position: number;
  text: string;
}

/** The summary's two picks; each is absent when no hot take had answers. */
export interface HotTakeHighlights {
  divisive?: HotTakeHighlight;
  agreed?: HotTakeHighlight;
}

/** The most divisive and the most agreed revealed hot take, for any member. */
export async function getHotTakeHighlights(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<HotTakeHighlights, "unknown">> {
  const { data, error } = await client.rpc("hot_take_highlights", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  const highlights: HotTakeHighlights = {};
  for (const row of data) {
    const highlight: HotTakeHighlight = {
      hotTakeId: row.hot_take_id,
      position: row.hot_take_position,
      text: row.hot_take_text,
      agree: row.agree_count,
      disagree: row.disagree_count,
    };
    if (row.highlight === "divisive") highlights.divisive = highlight;
    if (row.highlight === "agreed") highlights.agreed = highlight;
  }
  return ok(highlights);
}

/** How often a guest sided with the majority. */
export interface HotTakeMajority {
  sided: number;
  /** The revealed hot takes they answered that had a majority. */
  answered: number;
}

/** The caller's own count, or null when they aren't a guest with a name. */
export async function getMyHotTakeMajority(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<HotTakeMajority | null, "unknown">> {
  const { data, error } = await client.rpc("my_hot_take_majority", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  const row = data[0];
  return ok(row ? { sided: row.sided, answered: row.answered } : null);
}

/** Answers arrive in bursts; one refetch per this long is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a hot take of the event
 * changes, such as an answer counting on it. Changes are only a signal to
 * refetch, so RLS applies to every read. Returns a function that stops it.
 */
export function subscribeToHotTakeChanges(
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
    .channel(`hottakes:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hot_takes",
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
