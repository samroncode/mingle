import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleHostProps } from "../../types";
import { RunControls } from "../../RunControls";
import { awardsNextMove } from "../screen";
import { useAwardCategories } from "../useAwardCategories";
import { useAwardsRun } from "../useAwardsRun";

/** The awards' section in the control panel: run them, and the categories. */
export function AwardsHost({
  event,
  code,
  hostKey,
  startDisabled,
}: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  const list = useAwardCategories(event.id);
  const running = event.current_module === "awards";
  const total = run.progress?.total ?? 0;
  const next = awardsNextMove(event, total);
  const current = running
    ? run.categories.find((c) => c.position === event.current_step)
    : undefined;
  const finished =
    !!run.progress && total > 0 && run.progress.revealed >= total;

  return (
    <section
      data-testid="awards-host"
      aria-labelledby="awards-host-title"
      className="space-y-3"
    >
      <h2 id="awards-host-title" className="text-lg font-semibold">
        {t("modules.awards.name")}
      </h2>
      {(run.failed || list.status === "error") && (
        <ErrorLine>{t("modules.awards.host.loadFailed")}</ErrorLine>
      )}
      {run.progress && (
        <div className="space-y-3">
          {running ? (
            <p
              data-testid="awards-progress"
              className="text-sm text-muted-foreground"
            >
              {next
                ? t("modules.awards.counter", {
                    number: event.current_step + 1,
                    total,
                  })
                : t("modules.awards.winnersStep")}
            </p>
          ) : (
            finished && (
              <p className="text-sm text-muted-foreground">
                {t("modules.awards.run.finished")}
              </p>
            )
          )}
          {current && next && (
            <Card className="p-3">
              <p className="font-medium">{current.text}</p>
            </Card>
          )}
          <RunControls
            code={code}
            hostKey={hostKey}
            module="awards"
            running={running}
            startDisabled={startDisabled}
            startLabelKey="modules.awards.run.start"
            next={next}
            stopLabelKey={next ? undefined : "modules.awards.run.backToParty"}
          />
        </div>
      )}
      {list.status === "ready" && list.categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("modules.awards.host.empty")}
        </p>
      )}
      {!running && list.status === "ready" && list.categories.length > 0 && (
        <ol className="space-y-2">
          {list.categories.map((category) => (
            <li key={category.id}>
              <Card className="p-3">
                <p className="font-medium">
                  {category.position + 1}. {category.text}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
