import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleHostProps } from "../../types";
import { RunControls } from "../../RunControls";
import { answeringGuests, hotTakesNextMove } from "../screen";
import { useHotTakes } from "../useHotTakes";
import { useHotTakesRun } from "../useHotTakesRun";

/** The hot takes' section in the control panel: run them, and the list. */
export function HotTakesHost({
  event,
  members,
  code,
  hostKey,
  startDisabled,
}: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useHotTakesRun(event);
  const list = useHotTakes(event.id);
  const running = event.current_module === "hottakes";
  const total = run.progress?.total ?? 0;
  const next = hotTakesNextMove(event, total);
  const current = running
    ? run.takes.find((h) => h.position === event.current_step)
    : undefined;
  const finished =
    !!run.progress && total > 0 && run.progress.revealed >= total;

  return (
    <section
      data-testid="hottakes-host"
      aria-labelledby="hottakes-host-title"
      className="space-y-3"
    >
      <h2 id="hottakes-host-title" className="text-lg font-semibold">
        {t("modules.hottakes.name")}
      </h2>
      {(run.failed || list.status === "error") && (
        <ErrorLine>{t("modules.hottakes.host.loadFailed")}</ErrorLine>
      )}
      {run.progress && (
        <div className="space-y-3">
          {running ? (
            <p
              data-testid="hottakes-progress"
              className="text-sm text-muted-foreground"
            >
              {next
                ? t("modules.hottakes.counter", {
                    number: event.current_step + 1,
                    total,
                  })
                : t("modules.hottakes.summaryStep")}
            </p>
          ) : (
            finished && (
              <p className="text-sm text-muted-foreground">
                {t("modules.hottakes.run.finished")}
              </p>
            )
          )}
          {current && next && (
            <Card className="p-3">
              <p className="font-medium">{current.text}</p>
              {event.phase === "open" && (
                <p
                  data-testid="hottakes-answered"
                  className="mt-1 text-sm font-medium"
                >
                  {t("modules.hottakes.answered", {
                    count: current.answerCount,
                    total: answeringGuests(members),
                  })}
                </p>
              )}
            </Card>
          )}
          <RunControls
            code={code}
            hostKey={hostKey}
            module="hottakes"
            running={running}
            startDisabled={startDisabled}
            startLabelKey="modules.hottakes.run.start"
            next={next}
            stopLabelKey={next ? undefined : "modules.hottakes.run.backToParty"}
          />
        </div>
      )}
      {list.status === "ready" && list.takes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("modules.hottakes.host.empty")}
        </p>
      )}
      {!running && list.status === "ready" && list.takes.length > 0 && (
        <ol className="space-y-2">
          {list.takes.map((take) => (
            <li key={take.id}>
              <Card className="p-3">
                <p className="font-medium">
                  {take.position + 1}. {take.text}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
