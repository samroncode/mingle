import { ErrorLine } from "@/components/ErrorLine";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isLanguage } from "@/i18n/language";
import { canEditHotTakes } from "@/lib/host/hottakes-edit";
import { isNicheId } from "@/niches";
import type { ModuleHostProps } from "../../types";
import { RunControls } from "../../RunControls";
import { answeringGuests, hotTakesNextMove } from "../screen";
import { SplitBars } from "../SplitBars";
import { useHotTakeResult } from "../useHotTakeResults";
import { useHotTakesRun } from "../useHotTakesRun";
import { HotTakesEdit } from "./HotTakesEdit";

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
  const [editing, setEditing] = useState(false);
  const running = event.current_module === "hottakes";
  const total = run.progress?.total ?? 0;
  const next = hotTakesNextMove(event, total);
  const current = running
    ? run.takes.find((h) => h.position === event.current_step)
    : undefined;
  const revealed = !!current && event.phase === "revealed";
  const result = useHotTakeResult(current?.id ?? "", revealed, run.version);
  const finished =
    !!run.progress && total > 0 && run.progress.revealed >= total;

  const niche = isNicheId(event.niche) ? event.niche : undefined;
  const language = isLanguage(event.language) ? event.language : undefined;
  const editable =
    !!run.progress &&
    !!niche &&
    !!language &&
    canEditHotTakes(event, run.progress);

  return (
    <section
      data-testid="hottakes-host"
      aria-labelledby="hottakes-host-title"
      className="space-y-3"
    >
      <h2 id="hottakes-host-title" className="text-lg font-semibold">
        {t("modules.hottakes.name")}
      </h2>
      {run.failed && (
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
              {revealed && result.status === "ready" && result.value && (
                <div className="mt-2">
                  <SplitBars split={result.value} />
                </div>
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
      {editing && niche && language ? (
        <HotTakesEdit
          event={event}
          niche={niche}
          language={language}
          hostKey={hostKey}
          takes={run.takes}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              {t("modules.hottakes.edit.edit")}
            </Button>
          )}
          {run.progress && run.takes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("modules.hottakes.host.empty")}
            </p>
          )}
          {!running && run.takes.length > 0 && (
            <ol className="space-y-2">
              {run.takes.map((take) => (
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
        </>
      )}
    </section>
  );
}
