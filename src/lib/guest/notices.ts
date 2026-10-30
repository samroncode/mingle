import type { NoticeView } from "@/api/notices";

/** The notice to show as a banner, and how many more are waiting behind it. */
export interface Banner {
  notice: NoticeView;
  more: number;
}

/**
 * The banner for a guest: the newest notice they have not dismissed that was
 * sent after they joined. `notices` is newest first. Earlier notices stay in
 * the Messages list but never greet a late joiner.
 */
export function pickBanner(
  notices: readonly NoticeView[],
  dismissed: ReadonlySet<string>,
  joinedAt: string | undefined,
): Banner | null {
  if (joinedAt === undefined) return null;
  const joined = Date.parse(joinedAt);
  const waiting = notices.filter(
    (notice) =>
      !dismissed.has(notice.id) && Date.parse(notice.createdAt) >= joined,
  );
  const [notice] = waiting;
  return notice ? { notice, more: waiting.length - 1 } : null;
}

function storageKey(eventId: string): string {
  return `mingle.dismissedNotices.${eventId}`;
}

/** The notice ids this device has dismissed for an event. */
export function readDismissed(eventId: string): Set<string> {
  try {
    const raw: unknown = JSON.parse(
      localStorage.getItem(storageKey(eventId)) ?? "[]",
    );
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

/** Remembers the dismissed ids on this device; silent when storage is off. */
export function writeDismissed(eventId: string, ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(storageKey(eventId), JSON.stringify([...ids]));
  } catch {
    // Storage can be unavailable (private mode); the banner then returns.
  }
}
