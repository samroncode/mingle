import { useEffect } from "react";
import { keepScreenAwake } from "@/lib/tv/wake-lock";

/** Keeps the screen awake while the component is mounted. */
export function useWakeLock(): void {
  useEffect(() => keepScreenAwake(navigator, document), []);
}
