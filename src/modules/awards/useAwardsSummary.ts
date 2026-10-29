import type { EventRow } from "@/api/events";
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
