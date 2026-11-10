import { getSupabase } from "./client";
import { fail, ok, type Result } from "./errors";
import {
  clearWheelSpinsAction,
  type HostActionResult,
  setWheelAutoTakeOffAction,
  spinWheelAction,
} from "./host-actions";
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

/** The host link every wheel action needs. */
export interface HostLink {
  code: string;
  key: string;
}

/**
 * Spins the wheel. The server draws the winner; read it back with
 * `getLatestSpin`. Fails with `not_enough_entries` (fewer than two entries on
 * the wheel), `invalid_transition` (the wheel isn't running, or the evening
 * ended), `module_disabled` and `rate_limited`.
 */
export async function spinWheel(
  link: HostLink,
): Promise<HostActionResult<Record<string, never>>> {
  return spinWheelAction(link);
}

/** Switches "take drawn entries off automatically" on or off. */
export async function setAutoTakeOff(
  link: HostLink,
  enabled: boolean,
): Promise<HostActionResult<Record<string, never>>> {
  return setWheelAutoTakeOffAction({ ...link, enabled });
}

/** Clears the list of spins drawn this evening. */
export async function clearSpins(
  link: HostLink,
): Promise<HostActionResult<Record<string, never>>> {
  return clearWheelSpinsAction(link);
}

/** One spin as a member of the event reads it. */
export interface WheelSpinView {
  id: string;
  /** Running number within the event, from 1. */
  number: number;
  /** The drawn entry; null once it has been deleted. */
  entryId: string | null;
  /** What the entry was called when it was drawn. */
  label: string;
  /** When the server recorded the spin. */
  spunAt: string;
}

const spinColumns = "id, number, entry_id, label, spun_at";

function toSpinView(row: {
  id: string;
  number: number;
  entry_id: string | null;
  label: string;
  spun_at: string;
}): WheelSpinView {
  return {
    id: row.id,
    number: row.number,
    entryId: row.entry_id,
    label: row.label,
    spunAt: row.spun_at,
  };
}

/** The latest spin of the event, or null when nothing has been drawn. */
export async function getLatestSpin(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<WheelSpinView | null, "unknown">> {
  const { data, error } = await client
    .from("wheel_spins")
    .select(spinColumns)
    .eq("event_id", eventId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return fail("unknown");
  return ok(data === null ? null : toSpinView(data));
}

/** The most spins one read returns; the list is for the host's memory. */
export const spinListLimit = 100;

/** The event's spins, newest first. Any member of the event can read them. */
export async function listWheelSpins(
  eventId: string,
  client: AppClient = getSupabase(),
): Promise<Result<WheelSpinView[], "unknown">> {
  const { data, error } = await client
    .from("wheel_spins")
    .select(spinColumns)
    .eq("event_id", eventId)
    .order("number", { ascending: false })
    .limit(spinListLimit);
  if (error) return fail("unknown");
  return ok(data.map(toSpinView));
}

/**
 * Calls `onChange` when a spin of the event is recorded or the list is
 * cleared. A signal to refetch, so RLS applies to every read; there is no
 * delay, because the TV starts its animation from the new spin. Returns a
 * function that stops it.
 */
export function subscribeToLatestSpin(
  eventId: string,
  onChange: () => void,
  client: AppClient = getSupabase(),
): () => void {
  // A random suffix: two views of one event must not share a channel.
  const channel = client
    .channel(`wheel-spins:${eventId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "wheel_spins",
        filter: `event_id=eq.${eventId}`,
      },
      onChange,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
