import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { winnerName } from "@/lib/competitions/tables";
import { StandingsTable } from "./StandingsTable";
import { useStandings } from "./useStandings";

interface CompetitionResultsProps {
  event: EventRow;
  members: MemberRow[];
  /** The viewer's own row is highlighted. */
  userId?: string;
}

/**
 * The final table of each competition with a match, and its winner on top.
 * Shows nothing while the activity is off or no match has been reported.
 */
export function CompetitionResults({
  event,
  members,
  userId,
}: CompetitionResultsProps) {
  const { t } = useTranslation();
  const { tables } = useStandings(event, members);
  if (tables.length === 0) return null;
  return (
    <section data-testid="summary-competitions" className="space-y-4">
      <h2 className="font-display text-3xl font-extrabold">
        {t("modules.competitions.summary.title")}
      </h2>
      {tables.map((table) => (
        <div
          key={table.competitionId}
          role="region"
          aria-label={table.name}
          className="space-y-2"
        >
          <h3 className="font-display text-xl font-bold">{table.name}</h3>
          <p data-testid="competition-winner" className="text-lg font-bold">
            {t("modules.competitions.summary.winner", {
              name:
                winnerName(table) ||
                t("modules.competitions.standings.someone"),
            })}
          </p>
          <StandingsTable table={table} size="phone" highlightId={userId} />
        </div>
      ))}
    </section>
  );
}
