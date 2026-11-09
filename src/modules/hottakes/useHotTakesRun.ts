import type { EventRow } from "@/api/events";
import {
  getHotTakeProgress,
  listHotTakes,
  subscribeToHotTakeChanges,
  type HotTakeProgress,
  type HotTakeView,
} from "@/api/hottakes";
import { useModuleRun, type ModuleRunSource } from "@/hooks/useModuleRun";

/** The data a running hottakes' views render, as the viewer may read it. */
export type HotTakesRunState = {
  progress: HotTakeProgress | null;
  takes: HotTakeView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them can read again. */
  version: number;
};

const source: ModuleRunSource<HotTakeProgress, HotTakeView> = {
  readProgress: getHotTakeProgress,
  readItems: listHotTakes,
  subscribe: subscribeToHotTakeChanges,
};

/** Reads the progress and the takes the viewer can read; see `useModuleRun`. */
export function useHotTakesRun(event: EventRow): HotTakesRunState {
  const { items, ...rest } = useModuleRun(event, source);
  return { ...rest, takes: items };
}
