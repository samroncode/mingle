import type { ModuleId } from "@/modules/registry";
import type { ActivityCounts } from "@/modules/types";

/**
 * The activity that is up next in Run: the first enabled one, in the event's
 * order, whose counts say it has items left to play. An activity without
 * counts is never up next; with no candidate the answer is null.
 */
export function upNext(
  order: readonly ModuleId[],
  counts: Partial<Record<ModuleId, ActivityCounts | undefined>>,
): ModuleId | null {
  return (
    order.find((id) => {
      const c = counts[id];
      return !!c && c.total > 0 && c.done < c.total;
    }) ?? null
  );
}
