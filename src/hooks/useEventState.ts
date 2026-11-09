import { useEffect, useMemo, useState } from "react";
import type { SnapshotErrorCode } from "@/api/errors";
import type { EventRow, MemberRow } from "@/api/events";
import { logError } from "@/api/log";
import {
  subscribeToEvent,
  type ConnectionState,
  type SnapshotResult,
} from "@/api/realtime";
import { createDowntimeWatcher } from "@/lib/connection/downtime";

/** An event as a view renders it, kept live by useEventState. */
export type EventState = {
  status: "loading" | "ready" | "error";
  event: EventRow | null;
  members: MemberRow[];
  /** Set when the latest fetch failed; the UI maps it to an i18n key. */
  error: SnapshotErrorCode | null;
};

export const initialEventState: EventState = {
  status: "loading",
  event: null,
  members: [],
  error: null,
};

/**
 * The state after a fetch. A failed fetch keeps the last snapshot, so a TV
 * doesn't go blank during a network glitch; the view decides what to show.
 */
export function nextEventState(
  previous: EventState,
  result: SnapshotResult,
): EventState {
  if (result.ok) {
    return { status: "ready", ...result.value, error: null };
  }
  return { ...previous, status: "error", error: result.error };
}

/** What a view gets: the event plus whether the live connection is down. */
export type LiveEventState = EventState & {
  /** True once the connection has been down for more than a few seconds. */
  reconnecting: boolean;
};

/** A calm "reconnecting" flag: quiet for a blip, logged once if it lasts. */
function useReconnecting(connection: ConnectionState): boolean {
  const [visible, setVisible] = useState(false);

  // One watcher per outage-free stretch: a change of `connection` restarts it
  // only through its own cleanup, so a blip never leaves a stale timer.
  useEffect(() => {
    if (connection !== "reconnecting") return;
    const watcher = createDowntimeWatcher({
      onNotice: setVisible,
      onLong: () =>
        void logError({
          area: "realtime",
          action: "subscribe",
          code: "realtime_down_long",
        }),
    });
    watcher.setDown(true);
    return () => {
      watcher.dispose();
      setVisible(false);
    };
  }, [connection]);

  return visible;
}

/**
 * Follows an event live (see subscribeToEvent) and stops when the component
 * unmounts or the id changes. The caller must already be a member.
 */
export function useEventState(eventId: string): LiveEventState {
  const [current, setCurrent] = useState({
    eventId,
    state: initialEventState,
  });
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const reconnecting = useReconnecting(connection);

  useEffect(
    () =>
      subscribeToEvent(
        eventId,
        (result) =>
          setCurrent((previous) => ({
            eventId,
            state: nextEventState(
              previous.eventId === eventId ? previous.state : initialEventState,
              result,
            ),
          })),
        undefined,
        setConnection,
      ),
    [eventId],
  );

  // A new id shows loading until its first snapshot arrives.
  const state = current.eventId === eventId ? current.state : initialEventState;
  return useMemo(() => ({ ...state, reconnecting }), [state, reconnecting]);
}
