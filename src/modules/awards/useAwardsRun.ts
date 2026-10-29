import { useEffect, useState } from "react";
import type { EventRow } from "@/api/events";
import {
  getAwardProgress,
  listAwardCategories,
  subscribeToAwardChanges,
  type AwardCategoryView,
  type AwardProgress,
} from "@/api/awards";

/** The awards data a running awards' views render, as the viewer may read it. */
export type AwardsRunState = {
  progress: AwardProgress | null;
  categories: AwardCategoryView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them (the voters) can read again. */
  version: number;
};

const empty: AwardsRunState = {
  progress: null,
  categories: [],
  failed: false,
  version: 0,
};

/**
 * Reads the awards' progress and the categories the viewer can read, again on
 * every new event snapshot (each flow move, and each reconnect) and when a
 * category changes. A failed read keeps the last data, so a TV doesn't go
 * blank during a network drop.
 */
export function useAwardsRun(event: EventRow): AwardsRunState {
  const [loaded, setLoaded] = useState({ eventId: event.id, state: empty });
  const [changes, setChanges] = useState(0);

  useEffect(
    () => subscribeToAwardChanges(event.id, () => setChanges((n) => n + 1)),
    [event.id],
  );

  useEffect(() => {
    let stale = false;
    void Promise.all([
      getAwardProgress(event.id),
      listAwardCategories(event.id),
    ]).then(([progress, categories]) => {
      if (stale) return;
      setLoaded((previous) => {
        const last = previous.eventId === event.id ? previous.state : empty;
        if (!progress.ok || !categories.ok) {
          return {
            eventId: event.id,
            state: { ...last, failed: true, version: last.version + 1 },
          };
        }
        return {
          eventId: event.id,
          state: {
            progress: progress.value,
            categories: categories.value,
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
