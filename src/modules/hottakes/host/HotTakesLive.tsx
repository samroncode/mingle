import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleLiveProps } from "../../types";
import { RunControls } from "../../RunControls";
import { answeringGuests, hotTakesNextMove } from "../screen";
import { SplitBars } from "../SplitBars";
import { useHotTakeResult } from "../useHotTakeResults";
import { useHotTakesRun } from "../useHotTakesRun";

/**
 * The running hot takes: the take, the answered count or the split, and the
 * one "next" button with Stop. Renders nothing while they are not running.
 */
export function HotTakesLive({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  part = "all",
}: ModuleLiveProps) {
  const { t } = useTranslation();
  const run = useHotTakesRun(event);
  const running = event.current_module === "hottakes";
  const total = run.progress?.total ?? 0;
  const next = hotTakesNextMove(event, total);
  const current = running
    ? run.takes.find((h) => h.position === event.current_step)
    : undefined;
  const revealed = !!current && event.phase === "revealed";
  const result = useHotTakeResult(current?.id ?? "", revealed, run.version);
  if (!running) return null;
  if (!run.progress) {
    return run.failed ? (
      <ErrorLine>{t("modules.hottakes.host.loadFailed")}</ErrorLine>
    ) : null;
  }

  return (
    <div data-testid="hottakes-live" className="space-y-3">
      {part !== "actions" && (
        <>
          <p data-testid="hottakes-progress" className="text-sm text-ink-muted">
            {next
              ? t("modules.hottakes.counter", {
                  number: event.current_step + 1,
                  total,
                })
              : t("modules.hottakes.summaryStep")}
          </p>
          {current && next && (
            <Card className="p-3">
              <p className="font-display font-bold">{current.text}</p>
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
        </>
      )}
      {part !== "status" && (
        <RunControls
          code={code}
          hostKey={hostKey}
          module="hottakes"
          running
          startDisabled={startDisabled}
          startLabelKey="modules.hottakes.run.start"
          next={next}
          stopLabelKey={next ? undefined : "modules.hottakes.run.backToParty"}
        />
      )}
    </div>
  );
}
