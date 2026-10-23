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
