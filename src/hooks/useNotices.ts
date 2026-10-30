import { useCallback, useEffect, useState } from "react";
import { listNotices, type NoticeView } from "@/api/notices";
import { useLoad } from "@/hooks/useLoad";
import { readDismissed, writeDismissed } from "@/lib/guest/notices";

/**
 * The event's notices, newest first, read again whenever the event's
 * `noticesVersion` changes and whenever the tab becomes visible. Also the ids
 * this device has dismissed. A failed read keeps what was shown before.
 */
export function useNotices(
  eventId: string,
  noticesVersion: number,
  enabled: boolean,
) {
  const [visibleCount, setVisibleCount] = useState(0);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setVisibleCount((count) => count + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const load = useLoad(`notices:${eventId}`, () => listNotices(eventId), {
    enabled,
    refresh: noticesVersion * 1000 + visibleCount,
    keepOnError: true,
  });
  const notices: NoticeView[] = load.status === "ready" ? load.value : [];

  const [dismissed, setDismissed] = useState(() => readDismissed(eventId));
  const dismiss = useCallback(
    (id: string) =>
      setDismissed((previous) => {
        const next = new Set(previous).add(id);
        writeDismissed(eventId, next);
        return next;
      }),
    [eventId],
  );

  return { notices, dismissed, dismiss };
}
