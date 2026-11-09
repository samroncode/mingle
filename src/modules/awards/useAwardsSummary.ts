import type { EventRow } from "@/api/events";
import type { ActivityCounts } from "../types";
import { useActivitySummary } from "../useActivitySummary";
import { useAwardsRun } from "./useAwardsRun";

/** "8 ..., not started" for the control panel header. */
export function useAwardsSummary(event: EventRow): string | undefined {
  const { progress } = useAwardsRun(event);
  return useActivitySummary(
    "awards",
    event,
    progress && { total: progress.total, done: progress.revealed },
  );
}

/** Items and items played, for the dashboard's progress bar. */
export function useAwardsCounts(event: EventRow): ActivityCounts | undefined {
  const { progress } = useAwardsRun(event);
  return progress
    ? { total: progress.total, done: progress.revealed }
    : undefined;
}
