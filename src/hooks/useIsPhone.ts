import { useSyncExternalStore } from "react";

/** Tailwind's `lg`: from here the host panel uses the wide layout. */
const WIDE = "(min-width: 1024px)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isPhone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia(WIDE).matches;
}

/** True below 1024px, so phone-only parts are not rendered at all on wide screens. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, isPhone, () => true);
}
