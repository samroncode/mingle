import { ErrorLine } from "@/components/ErrorLine";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isLanguage } from "@/i18n/language";
import { canEditAwards } from "@/lib/host/awards-edit";
import { isNicheId } from "@/niches";
import type { ModuleHostProps } from "../../types";
import { RunControls } from "../../RunControls";
import { awardsNextMove } from "../screen";
import { useAwardsRun } from "../useAwardsRun";
import { AwardsEdit } from "./AwardsEdit";
import { Tally } from "./Tally";
import { VoteStatus } from "./VoteStatus";

/** The awards' section in the control panel: run them, and the categories. */
export function AwardsHost({
  event,
  members,
  code,
  hostKey,
  startDisabled,
}: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  const [editing, setEditing] = useState(false);
  const running = event.current_module === "awards";
  const total = run.progress?.total ?? 0;
  const next = awardsNextMove(event, total);
  const current = running
    ? run.categories.find((c) => c.position === event.current_step)
    : undefined;
  const finished =
    !!run.progress && total > 0 && run.progress.revealed >= total;

  const niche = isNicheId(event.niche) ? event.niche : undefined;
  const language = isLanguage(event.language) ? event.language : undefined;
  const editable =
    !!run.progress &&
    !!niche &&
    !!language &&
    canEditAwards(event, run.progress);

  return (
    <section
      data-testid="awards-host"
      aria-labelledby="awards-host-title"
      className="space-y-3"
    >
      <h2
        id="awards-host-title"
        className="font-display text-xl font-extrabold"
      >
        {t("modules.awards.name")}
      </h2>
      {run.failed && (
        <ErrorLine>{t("modules.awards.host.loadFailed")}</ErrorLine>
      )}
      {run.progress && (
        <div className="space-y-3">
          {running ? (
            <p data-testid="awards-progress" className="text-sm text-ink-muted">
              {next
                ? t("modules.awards.counter", {
                    number: event.current_step + 1,
                    total,
                  })
                : t("modules.awards.winnersStep")}
            </p>
          ) : (
            finished && (
              <p className="text-sm text-ink-muted">
                {t("modules.awards.run.finished")}
              </p>
            )
          )}
          {current && next && (
            <Card className="p-3">
              <p className="font-display font-bold">{current.text}</p>
              {event.phase === "open" && (
                <VoteStatus
                  category={current}
                  members={members}
                  version={run.version}
                />
              )}
              {event.phase === "revealed" && (
                <Tally
                  category={current}
                  members={members}
                  language={event.language}
                  version={run.version}
                />
              )}
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
      {editing && niche && language ? (
        <AwardsEdit
          event={event}
          niche={niche}
          language={language}
          hostKey={hostKey}
          categories={run.categories}
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
              {t("modules.awards.edit.edit")}
            </Button>
          )}
          {run.progress && run.categories.length === 0 && (
            <p className="text-sm text-ink-muted">
              {t("modules.awards.host.empty")}
            </p>
          )}
          {!running && run.categories.length > 0 && (
            <ol className="space-y-2">
              {run.categories.map((category) => (
                <li key={category.id}>
                  <Card className="p-3">
                    <p className="font-display font-bold">
                      {category.position + 1}. {category.text}
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
