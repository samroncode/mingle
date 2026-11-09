import { lazy, type ComponentType } from "react";
import { logError } from "@/api/log";

/**
 * Runs a dynamic import. If the chunk cannot be fetched (offline, or a new
 * deploy removed the old file), the failure is logged with a code only and
 * rethrown, so the router's error page shows its translated reload button.
 */
export async function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    void logError({
      area: "router",
      action: "load_chunk",
      code: "chunk_load_failed",
    });
    throw error;
  }
}

/** A lazily loaded view (named export) that logs a failed chunk load. */
export function lazyView<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) {
  return lazy(async () => ({
    default: (await loadChunk(load))[name],
  }));
}
