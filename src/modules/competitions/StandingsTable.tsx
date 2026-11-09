import { useTranslation } from "react-i18next";
import type { CompetitionTable } from "@/lib/competitions/tables";
import { cn } from "@/lib/utils";

interface StandingsTableProps {
  table: CompetitionTable;
  /** TV: big type for reading across a room. Phone: compact. */
  size: "tv" | "phone";
  /** The row of this member is highlighted. */
  highlightId?: string;
  /** Show only the best rows (the TV has room for a few). */
  limit?: number;
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** One competition's table: played, wins, losses and score difference. */
export function StandingsTable({
  table,
  size,
  highlightId,
  limit,
}: StandingsTableProps) {
  const { t } = useTranslation();
  const tv = size === "tv";
  const rows = limit ? table.rows.slice(0, limit) : table.rows;
  const cell = tv ? "px-(--space-4) py-2" : "px-2 py-1.5";
  const numeric = cn(cell, "text-right tabular-nums");
  return (
    <table
      data-testid="standings-table"
      aria-label={t("modules.competitions.standings.tableLabel", {
        name: table.name,
      })}
      className={cn(
        "w-full border-collapse text-left",
        tv ? "font-display text-4xl font-bold" : "text-base",
      )}
    >
      <thead>
        <tr
          className={cn(
            "border-b-[length:var(--border-thin)] border-line text-ink-muted",
            tv ? "font-body text-2xl font-medium" : "text-sm",
          )}
        >
          <th scope="col" className={cn(cell, "font-medium")}>
            {t("modules.competitions.standings.player")}
          </th>
          {(["played", "wins", "losses", "diff"] as const).map((key) => (
            <th
              key={key}
              scope="col"
              className={cn(numeric, "font-medium")}
              title={t(`modules.competitions.standings.${key}Full`)}
            >
              <span aria-hidden="true">
                {t(`modules.competitions.standings.${key}`)}
              </span>
              <span className="sr-only">
                {t(`modules.competitions.standings.${key}Full`)}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const mine = row.userId === highlightId;
          return (
            <tr
              key={row.userId}
              data-mine={mine || undefined}
              className={cn(
                "border-b-[length:var(--border-thin)] border-line",
                mine && "bg-champagne-soft",
              )}
            >
              <th scope="row" className={cn(cell, "truncate font-bold")}>
                {row.name || t("modules.competitions.standings.someone")}
                {mine && (
                  <span className="ml-2 font-body text-sm font-medium text-champagne-text">
                    ({t("modules.competitions.standings.you")})
                  </span>
                )}
              </th>
              <td className={numeric}>{row.played}</td>
              <td className={numeric}>{row.wins}</td>
              <td className={numeric}>{row.losses}</td>
              <td className={numeric}>{signed(row.difference)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
