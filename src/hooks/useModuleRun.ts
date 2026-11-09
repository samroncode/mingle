import { useEffect, useState } from "react";
import type { EventRow } from "@/api/events";
import type { Result } from "@/api/errors";
import { startLoad } from "./useLoad";

/** What an activity's views render while it runs, as the viewer may read it. */
export type ModuleRun<P, I> = {
  progress: P | null;
  items: I[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them (results, voters) can read again. */
  version: number;
};

/** How one activity reads its run data. Define it once, at module level. */
export type ModuleRunSource<P, I> = {
  readProgress: (eventId: string) => Promise<Result<P, string>>;
  readItems: (eventId: string) => Promise<Result<I[], string>>;
  /** Calls `onChange` on every change; returns the unsubscribe function. */
  subscribe: (eventId: string, onChange: () => void) => () => void;
};

type Loaded<P, I> = { eventId: string; state: ModuleRun<P, I> };

function empty<P, I>(): ModuleRun<P, I> {
  return { progress: null, items: [], failed: false, version: 0 };
}

/** The state after a read: new data, or the last data marked as failed. */
export function nextRun<P, I>(
  last: ModuleRun<P, I>,
  progress: Result<P, string>,
  items: Result<I[], string>,
): ModuleRun<P, I> {
  const version = last.version + 1;
  if (!progress.ok || !items.ok) return { ...last, failed: true, version };
  return {
    progress: progress.value,
    items: items.value,
    failed: false,
    version,
  };
}

/**
 * Reads an activity's progress and items, again on every new event snapshot
 * (each flow move, and each reconnect) and on every change the activity
 * reports. A failed read keeps the last data, so a TV doesn't go blank during
 * a network drop; a late answer after the event changed is dropped.
 */
export function useModuleRun<P, I>(
  event: EventRow,
  source: ModuleRunSource<P, I>,
): ModuleRun<P, I> {
  const [loaded, setLoaded] = useState<Loaded<P, I>>({
    eventId: event.id,
    state: empty(),
  });
  const [changes, setChanges] = useState(0);

  useEffect(
    () => source.subscribe(event.id, () => setChanges((n) => n + 1)),
    // `source` is a module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event.id],
  );

  useEffect(
    () =>
      startLoad(
        async () => {
          const [progress, items] = await Promise.all([
            source.readProgress(event.id),
            source.readItems(event.id),
          ]);
          return { ok: true, value: { progress, items } };
        },
        (result) => {
          if (!result.ok) return;
          const { progress, items } = result.value;
          setLoaded((previous) => ({
            eventId: event.id,
            state: nextRun(
              previous.eventId === event.id ? previous.state : empty(),
              progress,
              items,
            ),
          }));
        },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, changes],
  );

  return loaded.eventId === event.id ? loaded.state : empty();
}
