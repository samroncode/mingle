import { useEffect, useState } from "react";
import type { FunLevel } from "@/lib/fun";

/** How long a reveal or winner moment stays at the party level. */
export const partyMomentMs = 4000;

/**
 * "party" for a few seconds after `key` starts being active, then "playful".
 * `key` names the moment (a question and its phase), so the next moment
 * gets its own few seconds. Inactive is always "playful".
 */
export function usePartyMoment(
  active: boolean,
  key: string,
  ms = partyMomentMs,
): FunLevel {
  const [expired, setExpired] = useState<string>();
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setExpired(key), ms);
    return () => clearTimeout(timer);
  }, [active, key, ms]);
  return active && expired !== key ? "party" : "playful";
}
