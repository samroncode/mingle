import { useEffect, useState } from "react";
import { findMyMembership } from "@/api/events";
import { ensureAnonymousSession } from "@/api/session";

/**
 * Finds the id of the event with this code once the host has claimed it.
 * Stays undefined until `enabled`, and while the lookup fails.
 */
export function useHostEventId(code: string | undefined, enabled: boolean) {
  const [found, setFound] = useState<{ code: string; id: string }>();

  useEffect(() => {
    if (!code || !enabled) return;
    let stale = false;
    void (async () => {
      try {
        const userId = await ensureAnonymousSession();
        const result = await findMyMembership(code, userId);
        if (!stale && result.ok && result.value.isMember) {
          setFound({ code, id: result.value.eventId });
        }
      } catch {
        // The panel shows its loading message; the host can reload.
      }
    })();
    return () => {
      stale = true;
    };
  }, [code, enabled]);

  return found && found.code === code ? found.id : undefined;
}
