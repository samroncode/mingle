import { useTranslation } from "react-i18next";
import type { ModuleViewProps } from "../../types";
import { awardsScreen } from "../screen";
import { useAwardResults, useAwardWinners } from "../useAwardResults";
import { TvCounter, TvStage } from "../../TvStage";
import { useAwardsRun } from "../useAwardsRun";
import { WinnersList } from "../WinnersList";
import { WinnerText } from "../WinnerText";

/** The left side of the TV while the awards run. */
export function AwardsTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  const screen = awardsScreen(event, run.progress, run.categories);
  const guests = members.filter((m) => m.role === "guest").length;
  const revealedCategory =
    screen.kind === "category" && screen.revealed ? screen.category : undefined;
  const winners = useAwardWinners(
    revealedCategory?.id ?? "",
    !!revealedCategory,
    run.version,
  );
  const results = useAwardResults(
    event.id,
    screen.kind === "winners",
    run.version,
  );

  return (
    <TvStage
      data-testid="awards-tv"
      data-screen={screen.kind}
      moment={!!revealedCategory || screen.kind === "winners"}
      momentKey={`${screen.kind}-${revealedCategory?.id ?? ""}`}
    >
      {screen.kind === "loading" && (
        <p className="font-display text-6xl font-extrabold">
          {t("modules.awards.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <>
          <TvCounter>
            {t("modules.awards.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <p className="tv-float font-display text-8xl leading-none font-extrabold">
            {t("modules.awards.tv.ready")}
          </p>
        </>
      )}
      {screen.kind === "category" && (
        <>
          <TvCounter>
            {t("modules.awards.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <h2 className="font-display text-6xl leading-tight font-extrabold">
            {screen.category.text}
          </h2>
          {!screen.revealed && (
            <p
              data-testid="awards-voted"
              className="font-display text-5xl font-bold text-champagne-text"
            >
              {t("modules.awards.voted", {
                count: screen.category.voteCount,
                total: guests,
              })}
            </p>
          )}
          {screen.revealed && winners.status === "ready" && (
            <p
              data-testid="awards-winner"
              className="font-display text-8xl leading-none font-extrabold text-champagne"
            >
              <WinnerText
                winners={winners.value}
                members={members}
                language={event.language}
              />
            </p>
          )}
        </>
      )}
      {screen.kind === "winners" && (
        <>
          <h2 className="font-display text-7xl font-extrabold">
            {t("modules.awards.winnersTitle")}
          </h2>
          {results.status === "ready" && (
            <WinnersList
              large
              results={results.value}
              members={members}
              language={event.language}
            />
          )}
        </>
      )}
    </TvStage>
  );
}
