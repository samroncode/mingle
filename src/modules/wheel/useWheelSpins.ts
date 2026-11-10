import { useEffect, useState } from "react";
import {
  listWheelSpins,
  subscribeToLatestSpin,
  type WheelSpinView,
} from "@/api/wheel";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * The event's spins, newest first, read again on every new spin or when the
 * host clears the list. A failed read keeps the last list.
 */
export function useWheelSpins(eventId: string): {
  spins: LoadState<WheelSpinView[]>;
  reload: () => void;
} {
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => subscribeToLatestSpin(eventId, reload), [eventId]);
  const spins = useLoad(eventId, () => listWheelSpins(eventId), {
    refresh: changes,
    keepOnError: true,
  });
  return { spins, reload };
}
