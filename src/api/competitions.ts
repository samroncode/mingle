import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

/** A competition as a member of the event reads it. */
export interface CompetitionView {
  id: string;
  /** 0-based place in the event's list. */
  position: number;
  /** Host-written, shown as typed in every language. */
  name: string;
}

/** The event's competitions in order. Any member of the event can read them. */
export async function listCompetitions(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<CompetitionView[], "unknown">> {
  const { data, error } = await client
    .from("competitions")
    .select("id, position, name")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(data);
}

/** Changes arrive in bursts (a reorder moves several rows); one refetch is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a competition of the event
 * changes. Changes are only a signal to refetch, so RLS applies to every
 * read. Returns a function that stops it.
 */
export function subscribeToCompetitionChanges(
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
    .channel(`competitions:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "competitions",
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
