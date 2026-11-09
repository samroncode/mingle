import { useEffect, useState } from "react";
import {
  listCompetitionMatches,
  subscribeToMatchChanges,
  type MatchView,
} from "@/api/competitions";
import { useLoad, type LoadState } from "@/hooks/useLoad";

/**
 * One competition's matches, read again on every change to the event's
 * matches (a change is only a signal; the read goes through RLS). A failed
 * read keeps the last list, so a network drop doesn't blank the table.
 */
export function useCompetitionMatches(
  eventId: string,
  competitionId: string | undefined,
): LoadState<MatchView[]> {
  const [changes, setChanges] = useState(0);
  useEffect(
    () => subscribeToMatchChanges(eventId, () => setChanges((n) => n + 1)),
    [eventId],
  );
  return useLoad(
    `${eventId}:${competitionId ?? ""}`,
    () => listCompetitionMatches(eventId, competitionId ?? ""),
    {
      enabled: competitionId !== undefined,
      refresh: changes,
      keepOnError: true,
    },
  );
}
