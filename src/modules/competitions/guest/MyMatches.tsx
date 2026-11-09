import { useTranslation } from "react-i18next";
import type { CompetitionView, MatchView } from "@/api/competitions";
import { Button } from "@/components/ui/button";
import type { LoadState } from "@/hooks/useLoad";

interface MyMatchesProps {
  userId: string;
  matches: LoadState<MatchView[]>;
  competitions: CompetitionView[];
  /** Guest names by member id. */
  names: ReadonlyMap<string, string>;
  onRetry: () => void;
}

/** The matches this guest played, newest first. */
export function MyMatches({
  userId,
  matches,
  competitions,
  names,
  onRetry,
}: MyMatchesProps) {
  const { t } = useTranslation();
  if (matches.status === "loading") return null;
  if (matches.status === "error") {
    return (
      <div data-testid="my-matches-error" className="space-y-2">
        <p role="alert" className="text-sm font-bold text-danger-text">
          {t("modules.competitions.guest.mineLoadFailed")}
        </p>
        <Button variant="secondary" onClick={onRetry}>
          {t("modules.competitions.guest.mineRetry")}
        </Button>
      </div>
    );
  }
  return (
    <section data-testid="my-matches" className="space-y-2">
      <h3 className="font-display text-xl font-bold">
        {t("modules.competitions.guest.mine")}
      </h3>
      {matches.value.length === 0 ? (
        <p className="text-ink-muted">
          {t("modules.competitions.guest.mineEmpty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.value.map((match) => {
            const won = match.winnerId === userId;
            const other = won ? match.loserId : match.winnerId;
            const competition = competitions.find(
              (c) => c.id === match.competitionId,
            );
            const hasScore =
              match.winnerScore !== null && match.loserScore !== null;
            const [mine, theirs] = won
              ? [match.winnerScore, match.loserScore]
              : [match.loserScore, match.winnerScore];
            return (
              <li
                key={match.id}
                className="flex items-baseline justify-between gap-3 rounded-md border-[length:var(--border-thin)] border-edge bg-paper px-3 py-2 text-on-paper"
              >
                <span>
                  {t(
                    won
                      ? "modules.competitions.guest.matchWon"
                      : "modules.competitions.guest.matchLost",
                    {
                      competition: competition?.name ?? "",
                      name:
                        names.get(other) ??
                        t("modules.competitions.guest.someone"),
                    },
                  )}
                </span>
                {hasScore && (
                  <span className="font-display font-bold">
                    {t("modules.competitions.guest.score", { mine, theirs })}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
