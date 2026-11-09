import { useEffect, useState } from "react";
import {
  listEventMatches,
  subscribeToMatchChanges,
  type HostMatchView,
} from "@/api/competitions";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * The event's most recent matches for the host, read again on every change to
 * them and whenever `reload` is called, such as right after the host fixed
 * one. A failed read keeps the last list.
 */
export function useEventMatches(eventId: string): {
  matches: LoadState<HostMatchView[]>;
  reload: () => void;
} {
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => subscribeToMatchChanges(eventId, reload), [eventId]);
  const matches = useLoad(eventId, () => listEventMatches(eventId), {
    refresh: changes,
    keepOnError: true,
  });
  return { matches, reload };
}
