import { useEffect, useState } from "react";
import {
  getLatestSpin,
  subscribeToLatestSpin,
  type WheelSpinView,
} from "@/api/wheel";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * The event's latest spin, read again whenever a spin is recorded or cleared.
 * A failed read keeps the last known spin.
 */
export function useTvSpin(
  eventId: string,
  enabled = true,
): LoadState<WheelSpinView | null> {
  const [changes, setChanges] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    return subscribeToLatestSpin(eventId, () => setChanges((n) => n + 1));
  }, [eventId, enabled]);
  return useLoad(eventId, () => getLatestSpin(eventId), {
    enabled,
    refresh: changes,
    keepOnError: true,
  });
}
