import { useTranslation } from "react-i18next";
import { standings } from "@/lib/competitions/standings";
import { TvStage } from "../../TvStage";
import type { ModuleViewProps } from "../../types";
import { useCompetitionMatches } from "../useCompetitionMatches";
import { useCompetitions } from "../useCompetitions";

/** How many rows fit on the TV; the rest is left out, best players first. */
const tvRows = 8;

/**
 * The TV while Competitions is in the spotlight: one competition's table in
 * full screen. The running step is the competition's position. The table
 * follows the matches live.
 */
export function CompetitionsTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const { competitions } = useCompetitions(event.id);
  const competition =
    competitions.status === "ready"
      ? competitions.value.find((c) => c.position === event.current_step)
      : undefined;
  const matches = useCompetitionMatches(event.id, competition?.id);

  const names = new Map(
    members.map((m) => [m.user_id, m.display_name ?? ""] as const),
  );
  const rows =
    matches.status === "ready"
      ? standings(matches.value, names).slice(0, tvRows)
      : [];
  const known = competition !== undefined && matches.status === "ready";

  return (
    <TvStage
      data-testid="competitions-tv"
      moment={false}
      momentKey={competition?.id ?? ""}
    >
      <h2 className="font-display text-6xl font-extrabold">
        {competition?.name ?? t("modules.competitions.name")}
      </h2>
      {known && rows.length === 0 && (
        <p
          data-testid="competitions-tv-empty"
          className="font-display text-4xl font-bold"
        >
          {t("modules.competitions.tv.empty")}
        </p>
      )}
      {rows.length > 0 && (
        <table data-testid="competitions-table" className="w-full text-4xl">
          <thead>
            <tr className="text-left text-2xl tracking-wide uppercase opacity-80">
              <th scope="col" className="w-20 py-2">
                {t("modules.competitions.table.place")}
              </th>
              <th scope="col" className="py-2">
                {t("modules.competitions.table.player")}
              </th>
              <th scope="col" className="py-2 text-right">
                {t("modules.competitions.table.played")}
              </th>
              <th scope="col" className="py-2 text-right">
                {t("modules.competitions.table.wins")}
              </th>
              <th scope="col" className="py-2 text-right">
                {t("modules.competitions.table.losses")}
              </th>
              <th scope="col" className="py-2 text-right">
                {t("modules.competitions.table.difference")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.userId}
                className="border-t-[length:var(--border-thin)] border-edge font-display font-bold"
              >
                <td className="py-4">{index + 1}</td>
                <td className="py-4 break-words">
                  {row.name || t("modules.competitions.table.someone")}
                </td>
                <td className="py-4 text-right">{row.played}</td>
                <td className="py-4 text-right">{row.wins}</td>
                <td className="py-4 text-right">{row.losses}</td>
                <td className="py-4 text-right">
                  {row.difference > 0 ? `+${row.difference}` : row.difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TvStage>
  );
}
