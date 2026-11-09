/** How long the connection may be down before anyone is told. */
export const noticeDelayMs = 5_000;
/** How long it may be down before it counts as a real problem worth a log. */
export const longDownMs = 60_000;

interface DowntimeOptions {
  /** Called when the notice should appear (true) or go away (false). */
  onNotice: (visible: boolean) => void;
  /** Called once per outage that outlasts `longMs`. */
  onLong: () => void;
  delayMs?: number;
  longMs?: number;
}

/**
 * Turns "connection is down / up" signals into a calm notice: it shows only
 * once the connection has been down for `delayMs` (a brief blip stays quiet)
 * and goes away as soon as the connection is back.
 */
export function createDowntimeWatcher({
  onNotice,
  onLong,
  delayMs = noticeDelayMs,
  longMs = longDownMs,
}: DowntimeOptions) {
  let down = false;
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let longTimer: ReturnType<typeof setTimeout> | undefined;

  function clear(): void {
    clearTimeout(noticeTimer);
    clearTimeout(longTimer);
  }

  return {
    setDown(next: boolean): void {
      if (next === down) return;
      down = next;
      clear();
      if (next) {
        noticeTimer = setTimeout(() => onNotice(true), delayMs);
        longTimer = setTimeout(onLong, longMs);
      } else {
        onNotice(false);
      }
    },
    dispose: clear,
  };
}
