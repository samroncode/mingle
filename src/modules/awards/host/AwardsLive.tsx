import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import type { ModuleLiveProps } from "../../types";
import { RunControls } from "../../RunControls";
import { awardsNextMove } from "../screen";
import { useAwardsRun } from "../useAwardsRun";
import { Tally } from "./Tally";
import { VoteStatus } from "./VoteStatus";

/**
 * The running awards: the category, the vote count or the tally, and the one
 * "next" button with Stop. Renders nothing while the awards are not running.
 */
export function AwardsLive({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  part = "all",
}: ModuleLiveProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  if (event.current_module !== "awards") return null;
  if (!run.progress) {
    return run.failed ? (
      <ErrorLine>{t("modules.awards.host.loadFailed")}</ErrorLine>
    ) : null;
  }
  const total = run.progress.total;
  const next = awardsNextMove(event, total);
  const current = run.categories.find((c) => c.position === event.current_step);

  return (
    <div data-testid="awards-live" className="space-y-3">
      {part !== "actions" && (
        <>
          <p data-testid="awards-progress" className="text-sm text-ink-muted">
            {next
              ? t("modules.awards.counter", {
                  number: event.current_step + 1,
                  total,
                })
              : t("modules.awards.winnersStep")}
          </p>
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
        </>
      )}
      {part !== "status" && (
        <RunControls
          code={code}
          hostKey={hostKey}
          module="awards"
          running
          startDisabled={startDisabled}
          startLabelKey="modules.awards.run.start"
          next={next}
          stopLabelKey={next ? undefined : "modules.awards.run.backToParty"}
        />
      )}
    </div>
  );
}
