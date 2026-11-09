import { useEffect, useState } from "react";
import {
  listCompetitions,
  subscribeToCompetitionChanges,
  type CompetitionView,
} from "@/api/competitions";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * The event's competitions, read again on every change to them and whenever
 * `reload` is called, such as right after the host saved a change (a missed
 * realtime message then leaves nothing stale). A failed read keeps the last
 * list, so the panel doesn't go blank on a network drop.
 */
export function useCompetitions(
  eventId: string,
  enabled = true,
): {
  competitions: LoadState<CompetitionView[]>;
  reload: () => void;
} {
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => {
    if (!enabled) return;
    return subscribeToCompetitionChanges(eventId, reload);
  }, [eventId, enabled]);
  const competitions = useLoad(eventId, () => listCompetitions(eventId), {
    enabled,
    refresh: changes,
    keepOnError: true,
  });
  return { competitions, reload };
}
