import { useTranslation } from "react-i18next";
import type { ModuleViewProps } from "../../types";
import { answeringGuests, hotTakesScreen } from "../screen";
import { HighlightsList } from "../HighlightsList";
import { SplitBars } from "../SplitBars";
import { useHotTakeHighlights, useHotTakeResult } from "../useHotTakeResults";
import { TvCounter, TvStage } from "../../TvStage";
import { useHotTakesRun } from "../useHotTakesRun";

/** The left side of the TV while the hot takes run. */
export function HotTakesTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const run = useHotTakesRun(event);
  const screen = hotTakesScreen(event, run.progress, run.takes);
  const revealedTake =
    screen.kind === "take" && screen.revealed ? screen.take : undefined;
  const result = useHotTakeResult(
    revealedTake?.id ?? "",
    !!revealedTake,
    run.version,
  );
  const highlights = useHotTakeHighlights(
    event.id,
    screen.kind === "summary",
    run.version,
  );

  return (
    <TvStage
      data-testid="hottakes-tv"
      data-screen={screen.kind}
      moment={!!revealedTake || screen.kind === "summary"}
      momentKey={`${screen.kind}-${revealedTake?.id ?? ""}`}
    >
      {screen.kind === "loading" && (
        <p className="font-display text-6xl font-extrabold">
          {t("modules.hottakes.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <>
          <TvCounter>
            {t("modules.hottakes.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <p className="tv-float font-display text-8xl leading-none font-extrabold">
            {t("modules.hottakes.tv.ready")}
          </p>
        </>
      )}
      {screen.kind === "take" && (
        <>
          <TvCounter>
            {t("modules.hottakes.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <h2 className="font-display text-6xl leading-tight font-extrabold">
            {screen.take.text}
          </h2>
          {!screen.revealed && (
            <p
              data-testid="hottakes-answered"
              className="font-display text-5xl font-bold text-champagne-text"
            >
              {t("modules.hottakes.answered", {
                count: screen.take.answerCount,
                total: answeringGuests(members),
              })}
            </p>
          )}
          {screen.revealed && result.status === "ready" && result.value && (
            <SplitBars split={result.value} large />
          )}
        </>
      )}
      {screen.kind === "summary" && (
        <>
          <h2 className="font-display text-7xl font-extrabold">
            {t("modules.hottakes.summaryTitle")}
          </h2>
          {highlights.status === "ready" && (
            <HighlightsList highlights={highlights.value} large />
          )}
        </>
      )}
    </TvStage>
  );
}
