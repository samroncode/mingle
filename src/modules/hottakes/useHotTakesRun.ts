import { useEffect, useState } from "react";
import type { EventRow } from "@/api/events";
import {
  getHotTakeProgress,
  listHotTakes,
  subscribeToHotTakeChanges,
  type HotTakeProgress,
  type HotTakeView,
} from "@/api/hottakes";

/** The hot takes data a running hot takes' views render, as the viewer may read it. */
export type HotTakesRunState = {
  progress: HotTakeProgress | null;
  takes: HotTakeView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them (the results) can read again. */
  version: number;
};

const empty: HotTakesRunState = {
  progress: null,
  takes: [],
  failed: false,
  version: 0,
};

/**
 * Reads the hot takes' progress and the hot takes the viewer can read, again
 * on every new event snapshot (each flow move, and each reconnect) and when a
 * hot take changes. A failed read keeps the last data, so a TV doesn't go
 * blank during a network drop.
 */
export function useHotTakesRun(event: EventRow): HotTakesRunState {
  const [loaded, setLoaded] = useState({ eventId: event.id, state: empty });
  const [changes, setChanges] = useState(0);

  useEffect(
    () => subscribeToHotTakeChanges(event.id, () => setChanges((n) => n + 1)),
    [event.id],
  );

  useEffect(() => {
    let stale = false;
    void Promise.all([
      getHotTakeProgress(event.id),
      listHotTakes(event.id),
    ]).then(([progress, takes]) => {
      if (stale) return;
      setLoaded((previous) => {
        const last = previous.eventId === event.id ? previous.state : empty;
        if (!progress.ok || !takes.ok) {
          return {
            eventId: event.id,
            state: { ...last, failed: true, version: last.version + 1 },
          };
        }
        return {
          eventId: event.id,
          state: {
            progress: progress.value,
            takes: takes.value,
            failed: false,
            version: last.version + 1,
          },
        };
      });
    });
    return () => {
      stale = true;
    };
  }, [event, changes]);

  return loaded.eventId === event.id ? loaded.state : empty;
}
