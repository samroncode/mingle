import { useEffect, useState } from "react";
import { findMyMembership } from "@/api/events";
import { ensureAnonymousSession } from "@/api/session";

/**
 * The id of the event with this code, once this device is its host. Call it
 * with `claimed` true only after the claim succeeded; `undefined` until then,
 * and when the lookup fails or finds no host membership.
 */
export function useHostEventId(
  code: string | undefined,
  claimed: boolean,
): string | undefined {
  const [found, setFound] = useState<{ code: string; eventId?: string }>();

  useEffect(() => {
    if (!code || !claimed) return;
    let stale = false;
    void (async () => {
      try {
        const userId = await ensureAnonymousSession();
        const result = await findMyMembership(code, userId);
        const eventId =
          result.ok && result.value.isMember && result.value.role === "host"
            ? result.value.eventId
            : undefined;
        if (!stale) setFound({ code, eventId });
      } catch {
        if (!stale) setFound({ code });
      }
    })();
    return () => {
      stale = true;
    };
  }, [code, claimed]);

  return found && found.code === code ? found.eventId : undefined;
}
