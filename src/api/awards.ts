import { getSupabase } from "./client";
import {
  fail,
  ok,
  toAnswerErrorCode,
  type AnswerErrorCode,
  type Result,
} from "./errors";
import type { AppClient } from "./session";

/** An award category as a member may read it. */
export interface AwardCategoryView {
  id: string;
  /** 0-based place in the awards. */
  position: number;
  text: string;
  /** How many guests have voted on it. */
  voteCount: number;
  /** Revealed, so its winner is known and it can't be changed any more. */
  revealed: boolean;
}

/**
 * The event's award categories in order. A host reads all of them; anyone
 * else only gets what RLS lets them read: a category that is shown now or
 * was revealed.
 */
export async function listAwardCategories(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<AwardCategoryView[], "unknown">> {
  const { data, error } = await client
    .from("award_categories")
    .select("id, position, text, vote_count, revealed_at")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      position: row.position,
      text: row.text,
      voteCount: row.vote_count,
      // The test fakes may leave the time out.
      revealed: Boolean(row.revealed_at),
    })),
  );
}

/** How far the awards have come: approved categories, and how many are revealed. */
export interface AwardProgress {
  total: number;
  revealed: number;
}

/**
 * The awards' progress, for any member of the event. A non-member, an unknown
 * id and an expired event all get `not_found`.
 */
export async function getAwardProgress(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<AwardProgress, "not_found" | "unknown">> {
  const { data, error } = await client.rpc("award_progress", {
    target_event_id: eventId,
  });
  if (error) return fail("unknown");
  const row = data[0];
  return row
    ? ok({ total: row.total, revealed: row.revealed })
    : fail("not_found");
}

/**
 * Saves the guest's vote on a category, or changes the one they gave. A
 * refusal from the database (the category isn't open any more, isn't the
 * current one, or the pick isn't a guest who can be voted for) is
 * `question_closed`.
 */
export async function voteForGuest(
  vote: {
    eventId: string;
    categoryId: string;
    voterId: string;
    /** The user id of the guest voted for. */
    votedForId: string;
  },
  client: AppClient = getSupabase(),
): Promise<Result<null, AnswerErrorCode>> {
  const { eventId, categoryId, voterId, votedForId } = vote;
  const change = () =>
    client
      .from("award_votes")
      .update({ voted_for_id: votedForId })
      .eq("category_id", categoryId)
      .eq("voter_id", voterId)
      .select("voted_for_id");

  const changed = await change();
  if (changed.error) return fail(toAnswerErrorCode(changed.error));
  if (changed.data.length > 0) return ok(null);

  // No row to change: either no vote yet, or the category is closed and the
  // policy hides the row from the update. Insert tells the two apart.
  const inserted = await client.from("award_votes").insert({
    category_id: categoryId,
    event_id: eventId,
    voter_id: voterId,
    voted_for_id: votedForId,
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

/** The user id the guest voted for on a category, or null if they haven't voted. */
export async function getMyAwardVote(
  categoryId: string,
  voterId: string,
  client: AppClient = getSupabase(),
): Promise<Result<string | null, "unknown">> {
  const { data, error } = await client
    .from("award_votes")
    .select("voted_for_id")
    .eq("category_id", categoryId)
    .eq("voter_id", voterId)
    .maybeSingle();
  if (error) return fail("unknown");
  return ok(data?.voted_for_id ?? null);
}

/**
 * The ids of the guests who have voted on the category the awards show now,
 * never whom they voted for. Only the host gets any; everyone else gets an
 * empty list, because no client reads another guest's vote.
 */
export async function listAwardVoters(
  categoryId: string,
  client: AppClient = getSupabase(),
): Promise<Result<string[], "unknown">> {
  const { data, error } = await client.rpc("award_voters", {
    target_category_id: categoryId,
  });
  if (error) return fail("unknown");
  return ok(data.map((row) => row.user_id));
}

/** Votes arrive in bursts; one refetch per this long is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a category of the event
 * changes, such as a new vote counting on it. Changes are only a signal to
 * refetch, so RLS applies to every read. Returns a function that stops it.
 */
export function subscribeToAwardChanges(
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
    .channel(`awards:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "award_categories",
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
