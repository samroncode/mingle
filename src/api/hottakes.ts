import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
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
