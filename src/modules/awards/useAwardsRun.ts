import type { EventRow } from "@/api/events";
import {
  getAwardProgress,
  listAwardCategories,
  subscribeToAwardChanges,
  type AwardProgress,
  type AwardCategoryView,
} from "@/api/awards";
import { useModuleRun, type ModuleRunSource } from "@/hooks/useModuleRun";

/** The data a running awards' views render, as the viewer may read it. */
export type AwardsRunState = {
  progress: AwardProgress | null;
  categories: AwardCategoryView[];
  /** The latest read failed; the last data read is kept. */
  failed: boolean;
  /** Counts the reads, so what hangs on them can read again. */
  version: number;
};

const source: ModuleRunSource<AwardProgress, AwardCategoryView> = {
  readProgress: getAwardProgress,
  readItems: listAwardCategories,
  subscribe: subscribeToAwardChanges,
};

/** Reads the progress and the categories the viewer can read; see `useModuleRun`. */
export function useAwardsRun(event: EventRow): AwardsRunState {
  const { items, ...rest } = useModuleRun(event, source);
  return { ...rest, categories: items };
}
