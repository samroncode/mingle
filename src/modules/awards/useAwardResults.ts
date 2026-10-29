import {
  getAwardTally,
  getAwardWinners,
  getMyAwardVotes,
  listAwardResults,
  listAwardsWon,
  type AwardResult,
  type AwardsWon,
  type AwardWinner,
} from "@/api/awards";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/** The winners of a category, once it is revealed. */
export function useAwardWinners(
  categoryId: string,
  enabled: boolean,
  version: number,
): LoadState<AwardWinner[]> {
  return useLoad(categoryId, () => getAwardWinners(categoryId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** The host's full count per guest on a revealed category. */
export function useAwardTally(
  categoryId: string,
  enabled: boolean,
  version: number,
): LoadState<AwardWinner[]> {
  return useLoad(categoryId, () => getAwardTally(categoryId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** The votes the guest got on a revealed category. */
export function useMyAwardVotes(
  categoryId: string,
  enabled: boolean,
  version: number,
): LoadState<number | null> {
  return useLoad(categoryId, () => getMyAwardVotes(categoryId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** Every revealed category with its winners, for the winners step. */
export function useAwardResults(
  eventId: string,
  enabled: boolean,
  version: number,
): LoadState<AwardResult[]> {
  return useLoad(eventId, () => listAwardResults(eventId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}

/** The awards won per guest (the caller's own row for a guest). */
export function useAwardsWon(
  eventId: string,
  enabled: boolean,
  version: number,
): LoadState<AwardsWon[]> {
  return useLoad(eventId, () => listAwardsWon(eventId), {
    enabled,
    refresh: version,
    keepOnError: true,
  });
}
