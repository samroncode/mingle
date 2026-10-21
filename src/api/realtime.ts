import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";
import { getSupabase } from "./client";
import type { Result, SnapshotErrorCode } from "./errors";
import { getEventSnapshot, type EventSnapshot } from "./events";
import type { AppClient } from "./session";

export type SnapshotResult = Result<EventSnapshot, SnapshotErrorCode>;

/** How long to wait before each new attempt after the channel fails. */
const retryDelaysMs = [1_000, 2_000, 5_000, 10_000, 30_000];

/** Gives every subscription its own channel, even for the same event. */
let channelCount = 0;

/**
 * Follows an event live. `onChange` gets a fresh snapshot once the
 * subscription is confirmed, after every change to the event or its members,
 * after a dropped channel comes back and when the tab becomes visible again.
 * Changes are only a signal to refetch, so RLS applies to every read and a
 * missed message doesn't matter. Returns a function that stops it all.
 */
export function subscribeToEvent(
  eventId: string,
  onChange: (snapshot: SnapshotResult) => void,
  client: AppClient = getSupabase(),
): () => void {
  let stopped = false;
  let latestFetch = 0;
  let failures = 0;
  let channel: RealtimeChannel | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  async function refetch(): Promise<void> {
    const fetchId = ++latestFetch;
    const snapshot = await getEventSnapshot(eventId, client);
    // A slower, older fetch must not overwrite a newer one.
    if (!stopped && fetchId === latestFetch) onChange(snapshot);
  }

  function subscribe(): void {
    if (stopped) return;
    const own = openChannel(client, eventId, () => void refetch());
    channel = own;
    own.subscribe((status) => {
      // Ignore the old channel closing after a retry or stop replaced it.
      if (stopped || channel !== own) return;
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
        failures = 0;
        void refetch();
      } else {
        retry();
      }
    });
  }

  function retry(): void {
    closeChannel();
    const delay = retryDelaysMs[Math.min(failures, retryDelaysMs.length - 1)];
    failures += 1;
    retryTimer = setTimeout(subscribe, delay);
  }

  /** Forgets the channel before removing it, so its CLOSED is ignored. */
  function closeChannel(): void {
    const old = channel;
    channel = undefined;
    if (old) void client.removeChannel(old);
  }

  /** A TV waking from sleep may have missed changes; catch up. */
  function onVisibilityChange(): void {
    if (document.visibilityState === "visible") void refetch();
  }

  const tab = typeof document === "undefined" ? undefined : document;
  tab?.addEventListener("visibilitychange", onVisibilityChange);
  subscribe();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    tab?.removeEventListener("visibilitychange", onVisibilityChange);
    closeChannel();
  };
}

/** A channel that calls `onSignal` on any change to the event or its members. */
function openChannel(
  client: AppClient,
  eventId: string,
  onSignal: () => void,
): RealtimeChannel {
  channelCount += 1;
  return client
    .channel(`event:${eventId}:${channelCount}`, {
      // Report SUBSCRIBED only once changes are really streaming, so the
      // fetch that follows can't miss one.
      config: { postgres_changes_options: { wait: true } },
    })
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "events",
        filter: `id=eq.${eventId}`,
      },
      onSignal,
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "members",
        filter: `event_id=eq.${eventId}`,
      },
      onSignal,
    );
}
