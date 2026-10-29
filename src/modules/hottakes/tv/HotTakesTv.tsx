import { useTranslation } from "react-i18next";
import type { ModuleViewProps } from "../../types";
import { answeringGuests, hotTakesScreen } from "../screen";
import { HighlightsList } from "../HighlightsList";
import { SplitBars } from "../SplitBars";
import { useHotTakeHighlights, useHotTakeResult } from "../useHotTakeResults";
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
    <section
      data-testid="hottakes-tv"
      data-screen={screen.kind}
      className="flex min-h-[70svh] flex-col justify-center gap-8"
    >
      {screen.kind === "loading" && (
        <p className="text-5xl font-semibold">{t("modules.hottakes.name")}</p>
      )}
      {screen.kind === "idle" && (
        <>
          <p className="text-4xl text-muted-foreground">
            {t("modules.hottakes.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <p className="text-7xl font-semibold">
            {t("modules.hottakes.tv.ready")}
          </p>
        </>
      )}
      {screen.kind === "take" && (
        <>
          <p className="text-3xl text-muted-foreground">
            {t("modules.hottakes.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <h2 className="text-6xl font-semibold">{screen.take.text}</h2>
          {!screen.revealed && (
            <p data-testid="hottakes-answered" className="text-4xl">
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
          <h2 className="text-6xl font-semibold">
            {t("modules.hottakes.summaryTitle")}
          </h2>
          {highlights.status === "ready" && (
            <HighlightsList highlights={highlights.value} large />
          )}
        </>
      )}
    </section>
  );
}
