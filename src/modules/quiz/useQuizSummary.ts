import type { EventRow } from "@/api/events";
import type { ActivityCounts } from "../types";
import { useActivitySummary } from "../useActivitySummary";
import { useQuizRun } from "./useQuizRun";

/** "8 ..., not started" for the control panel header. */
export function useQuizSummary(event: EventRow): string | undefined {
  const { progress } = useQuizRun(event);
  return useActivitySummary(
    "quiz",
    event,
    progress && { total: progress.total, done: progress.played },
  );
}

/** Items and items played, for the dashboard's progress bar. */
export function useQuizCounts(event: EventRow): ActivityCounts | undefined {
  const { progress } = useQuizRun(event);
  return progress
    ? { total: progress.total, done: progress.played }
    : undefined;
}
