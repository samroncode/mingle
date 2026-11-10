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
 * The event's spins, newest first, read again on every change to them. The
 * host's own screen also reads again right after its own Spin or Clear, so the
 * result shows at once; a failed read keeps the last list.
 */
export function useWheelSpins(eventId: string): LoadState<WheelSpinView[]> {
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    const reload = () => setChanges((n) => n + 1);
    window.addEventListener(wheelChanged, reload);
    const stop = subscribeToLatestSpin(eventId, reload);
    return () => {
      window.removeEventListener(wheelChanged, reload);
      stop();
    };
  }, [eventId]);
  return useLoad(eventId, () => listWheelSpins(eventId), {
    refresh: changes,
    keepOnError: true,
  });
}
