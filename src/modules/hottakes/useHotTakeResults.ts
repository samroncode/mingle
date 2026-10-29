import {
  getHotTakeHighlights,
  getHotTakeResult,
  getMyHotTakeMajority,
  type HotTakeHighlights,
  type HotTakeMajority,
  type HotTakeSplit,
} from "@/api/hottakes";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/** The split of a revealed hot take. */
export function useHotTakeResult(
  hotTakeId: string,
  enabled: boolean,
  version: number,
): LoadState<HotTakeSplit | null> {
  return useLoad(hotTakeId, () => getHotTakeResult(hotTakeId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** The most divisive and the most agreed hot take, for the summary step. */
export function useHotTakeHighlights(
  eventId: string,
  enabled: boolean,
  version: number,
): LoadState<HotTakeHighlights> {
  return useLoad(eventId, () => getHotTakeHighlights(eventId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** How often the guest sided with the majority, for the summary step. */
export function useMyHotTakeMajority(
  eventId: string,
  enabled: boolean,
  version: number,
): LoadState<HotTakeMajority | null> {
  return useLoad(eventId, () => getMyHotTakeMajority(eventId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}
