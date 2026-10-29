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
