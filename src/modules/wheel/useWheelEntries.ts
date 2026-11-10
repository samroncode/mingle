import { useEffect, useState } from "react";
import {
  listWheelEntries,
  subscribeToWheelChanges,
  type WheelEntryView,
} from "@/api/wheel";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * The event's wheel entries, read again on every change to them and whenever
 * `reload` is called, such as right after the host saved a change. A failed
 * read keeps the last list.
 */
export function useWheelEntries(
  eventId: string,
  enabled = true,
): {
  entries: LoadState<WheelEntryView[]>;
  reload: () => void;
} {
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => {
    if (!enabled) return;
    return subscribeToWheelChanges(eventId, reload);
  }, [eventId, enabled]);
  const entries = useLoad(eventId, () => listWheelEntries(eventId), {
    enabled,
    refresh: changes,
    keepOnError: true,
  });
  return { entries, reload };
}
