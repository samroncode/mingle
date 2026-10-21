import { useEffect, useState } from "react";
import type { SnapshotErrorCode } from "@/api/errors";
import type { EventRow, MemberRow } from "@/api/events";
import { subscribeToEvent, type SnapshotResult } from "@/api/realtime";

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

/**
 * Follows an event live (see subscribeToEvent) and stops when the component
 * unmounts or the id changes. The caller must already be a member.
 */
export function useEventState(eventId: string): EventState {
  const [current, setCurrent] = useState({
    eventId,
    state: initialEventState,
  });

  useEffect(
    () =>
      subscribeToEvent(eventId, (result) =>
        setCurrent((previous) => ({
          eventId,
          state: nextEventState(
            previous.eventId === eventId ? previous.state : initialEventState,
            result,
          ),
        })),
      ),
    [eventId],
  );

  // A new id shows loading until its first snapshot arrives.
  return current.eventId === eventId ? current.state : initialEventState;
}
