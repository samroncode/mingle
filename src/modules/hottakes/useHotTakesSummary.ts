import type { EventRow } from "@/api/events";
import type { ActivityCounts } from "../types";
import { useActivitySummary } from "../useActivitySummary";
import { useHotTakesRun } from "./useHotTakesRun";

/** "8 ..., not started" for the control panel header. */
export function useHotTakesSummary(event: EventRow): string | undefined {
  const { progress } = useHotTakesRun(event);
  return useActivitySummary(
    "hottakes",
    event,
    progress && { total: progress.total, done: progress.revealed },
  );
}

/** Items and items played, for the dashboard's progress bar. */
export function useHotTakesCounts(event: EventRow): ActivityCounts | undefined {
  const { progress } = useHotTakesRun(event);
  return progress
    ? { total: progress.total, done: progress.revealed }
    : undefined;
}
