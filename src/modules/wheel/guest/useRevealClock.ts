import { useEffect, useState } from "react";
import { nextRevealIn, type TimedSpin } from "@/lib/wheel/reveal";

/**
 * The current time, moved on exactly when the next hidden spin may be shown,
 * so a view re-renders then and not on a timer of its own.
 */
export function useRevealClock(spins: readonly TimedSpin[]): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const wait = nextRevealIn(spins, Date.now());
    if (wait === null) return;
    const timer = setTimeout(() => setNow(Date.now()), wait + 20);
    return () => clearTimeout(timer);
  }, [spins]);
  return now;
}
