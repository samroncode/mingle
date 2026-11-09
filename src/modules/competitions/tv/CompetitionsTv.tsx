import { useTranslation } from "react-i18next";
import { StandingsTable } from "../StandingsTable";
import { useStandings } from "../useStandings";
import type { ModuleViewProps } from "../../types";

/** The TV while Competitions is in the spotlight: every table with a match. */
export function CompetitionsTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const { tables } = useStandings(event, members);
  return (
    <section data-testid="competitions-tv" className="space-y-(--space-6)">
      <p className="font-display text-5xl font-extrabold">
        {t("modules.competitions.name")}
      </p>
      {tables.map((table) => (
        <div key={table.competitionId} className="space-y-(--space-3)">
          <h2 className="font-display text-3xl font-extrabold text-champagne-text">
            {table.name}
          </h2>
          <StandingsTable table={table} size="tv" limit={5} />
        </div>
      ))}
    </section>
  );
}
