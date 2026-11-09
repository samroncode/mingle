import { useEffect, useState } from "react";
import { listAllMatches, subscribeToMatchChanges } from "@/api/competitions";
import type { EventRow, MemberRow } from "@/api/events";
import { useLoad } from "@/hooks/useLoad";
import { tablesOf, type CompetitionTable } from "@/lib/competitions/standings";
import { useCompetitions } from "./useCompetitions";

/**
 * The event's tables, one per competition with a match, read again on every
 * change to competitions or matches. A failed read keeps the last tables.
 * `reload` reads again at once, such as right after the guest reported a
 * match. Empty while the activity is off, so nothing shows then.
 */
export function useStandings(
  event: EventRow,
  members: MemberRow[],
): { tables: CompetitionTable[]; reload: () => void } {
  const enabled = event.enabled_modules.includes("competitions");
  const { competitions } = useCompetitions(event.id, enabled);
  const [changes, setChanges] = useState(0);
  const reload = () => setChanges((n) => n + 1);
  useEffect(() => {
    if (!enabled) return;
    return subscribeToMatchChanges(event.id, reload);
  }, [event.id, enabled]);
  const matches = useLoad(event.id, () => listAllMatches(event.id), {
    enabled,
    refresh: changes,
    keepOnError: true,
  });
  if (
    !enabled ||
    competitions.status !== "ready" ||
    matches.status !== "ready"
  ) {
    return { tables: [], reload };
  }
  const names = new Map(
    members.map((member) => [member.user_id, member.display_name ?? ""]),
  );
  return {
    tables: tablesOf(competitions.value, matches.value, names),
    reload,
  };
}
