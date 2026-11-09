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
import { useHotTakesRun } from "../useHotTakesRun";
import { HotTakesEdit } from "./HotTakesEdit";
import { HotTakesLive } from "./HotTakesLive";

/** The hot takes' section in the control panel: run them, and the list. */
export function HotTakesHost({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  compact,
}: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useHotTakesRun(event);
  const [editing, setEditing] = useState(false);
  const running = event.current_module === "hottakes";
  const total = run.progress?.total ?? 0;
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
      aria-label={t("modules.hottakes.name")}
      className="space-y-3"
    >
      {run.failed && !running && (
        <ErrorLine>{t("modules.hottakes.host.loadFailed")}</ErrorLine>
      )}
      {running
        ? !compact && (
            <HotTakesLive
              event={event}
              members={members}
              code={code}
              hostKey={hostKey}
              startDisabled={startDisabled}
            />
          )
        : run.progress &&
          !compact && (
            <div className="space-y-3">
              {finished && (
                <p className="text-sm text-ink-muted">
                  {t("modules.hottakes.run.finished")}
                </p>
              )}
              <RunControls
                code={code}
                hostKey={hostKey}
                module="hottakes"
                running={false}
                startDisabled={startDisabled}
                startLabelKey="modules.hottakes.run.start"
                next={null}
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
            <p className="text-sm text-ink-muted">
              {t("modules.hottakes.host.empty")}
            </p>
          )}
          {!running && run.takes.length > 0 && (
            <ol className="space-y-2">
              {run.takes.map((take) => (
                <li key={take.id}>
                  <Card className="p-3">
                    <p className="font-display font-bold">
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
