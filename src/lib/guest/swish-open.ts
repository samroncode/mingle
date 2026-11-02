/** How long to wait for the Swish app to take over before calling it a miss. */
export const SWISH_OPEN_WAIT_MS = 2000;

/**
 * Watches a tap on the Swish link. When the Swish app opens, the browser goes
 * to the background (the page is hidden). If the page is still in view after
 * the wait, the app did not open and `onFailed` runs. Returns a cancel
 * function; call it on unmount.
 */
export function watchSwishOpen(
  onFailed: () => void,
  doc: Pick<
    Document,
    "visibilityState" | "addEventListener" | "removeEventListener"
  > = document,
  wait = SWISH_OPEN_WAIT_MS,
): () => void {
  const cancel = () => {
    clearTimeout(timer);
    doc.removeEventListener("visibilitychange", onChange);
  };
  const onChange = () => {
    if (doc.visibilityState === "hidden") cancel();
  };
  const timer = setTimeout(() => {
    cancel();
    if (doc.visibilityState === "visible") onFailed();
  }, wait);
  doc.addEventListener("visibilitychange", onChange);
  return cancel;
}
