import { useEffect, useState } from "react";
import {
  listWheelSpins,
  subscribeToLatestSpin,
  type WheelSpinView,
} from "@/api/wheel";
import { useLoad, type LoadState } from "@/hooks/useLoad";
import { announceWheelChanged, wheelChanged } from "./wheelChanged";

/** Tells every wheel view on this screen to read the spins and entries again. */
export const announceSpinsChanged = announceWheelChanged;

/**
 * The event's spins, newest first, read again on every new spin or when the
 * host clears the list. The host's own screen also reads again right after its
 * own Spin or Clear (`announceSpinsChanged`), so the result shows at once. A
 * failed read keeps the last list.
 */
export function useWheelSpins(eventId: string): {
  spins: LoadState<WheelSpinView[]>;
  reload: () => void;
} {
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => {
    const again = () => setChanges((n) => n + 1);
    window.addEventListener(wheelChanged, again);
    const stop = subscribeToLatestSpin(eventId, again);
    return () => {
      window.removeEventListener(wheelChanged, again);
      stop();
    };
  }, [eventId]);
  const spins = useLoad(eventId, () => listWheelSpins(eventId), {
    refresh: changes,
    keepOnError: true,
  });
  return { spins, reload };
}
