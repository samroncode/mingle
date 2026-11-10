import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import type { AppClient } from "./session";

/**
 * One entry on the Lucky wheel as a member of the event reads it. A guest
 * entry has a `memberId` and no label (the screen shows the guest's current
 * display name); a custom entry has the host's text and no `memberId`.
 */
export interface WheelEntryView {
  id: string;
  kind: "guest" | "custom";
  memberId: string | null;
  /** Host-written text of a custom entry, shown as typed in every language. */
  label: string | null;
  /** On the wheel, or taken off it (and possible to put back). */
  state: "on" | "off";
  position: number;
}

/** The event's wheel entries in order. Any member of the event can read them. */
export async function listWheelEntries(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<WheelEntryView[], "unknown">> {
  const { data, error } = await client
    .from("wheel_entries")
    .select("id, kind, member_id, label, state, position")
    .eq("event_id", eventId)
    .order("position");
  if (error) return fail("unknown");
  return ok(
    data.map((row) => ({
      id: row.id,
      kind: row.kind === "guest" ? "guest" : "custom",
      memberId: row.member_id,
      label: row.label,
      state: row.state === "off" ? "off" : "on",
      position: row.position,
    })),
  );
}

/** Adding several guests is several rows at once; one refetch is enough. */
const CHANGE_DELAY_MS = 300;

/**
 * Calls `onChange` (at most once per burst) when a wheel entry of the event
 * changes. Changes are only a signal to refetch, so RLS applies to every
 * read. Returns a function that stops it.
 */
export function subscribeToWheelChanges(
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
    .channel(`wheel:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "wheel_entries",
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
