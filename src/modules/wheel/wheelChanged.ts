/** Sent on the window when the host's own screen changed the wheel. */
export const wheelChanged = "mingle:wheel-changed";

/**
 * Tells every wheel view on this screen to read again right away, instead of
 * waiting for the realtime signal (the host's result must show at once).
 */
export function announceWheelChanged() {
  window.dispatchEvent(new Event(wheelChanged));
}
