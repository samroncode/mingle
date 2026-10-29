import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
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
