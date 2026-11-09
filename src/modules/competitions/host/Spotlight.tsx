import { useTranslation } from "react-i18next";
import type { CompetitionView } from "@/api/competitions";
import { setFlow } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import { spotlightErrorKey } from "@/lib/host/competitions-errors";
import type { FlowMove } from "@/lib/schemas/host-actions";
import type { ModuleHostProps } from "../../types";
import { CompetitionsLive } from "./CompetitionsLive";

interface SpotlightProps extends Pick<
  ModuleHostProps,
  "event" | "members" | "code" | "hostKey" | "startDisabled"
> {
  competitions: CompetitionView[];
}

/**
 * "Show on TV": puts one competition's table on the TV in full screen, and
 * stops it again. The running step is the competition's position. Matches can
 * still be reported while it runs.
 */
export function Spotlight({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  competitions,
}: SpotlightProps) {
  const { t } = useTranslation();
  const { busy, error, run } = useHostAction(spotlightErrorKey, "host");
  const running = event.current_module === "competitions";
  const ended = event.status === "ended";

  function send(move: FlowMove) {
    void run(
      () => setFlow({ code, key: hostKey, move }),
      `spotlight_${move.type}`,
    );
  }

  return (
    <div data-testid="competitions-spotlight" className="space-y-2">
      <h3 className="font-display font-bold">
        {t("modules.competitions.host.spotlight.title")}
      </h3>
      {running ? (
        <CompetitionsLive
          event={event}
          members={members}
          code={code}
          hostKey={hostKey}
          startDisabled={startDisabled}
        />
      ) : (
        <>
          <p
            data-testid="competitions-spotlight-state"
            className="text-sm text-ink-muted"
          >
            {t("modules.competitions.host.spotlight.off")}
          </p>
          <ul className="space-y-2">
            {competitions.map((competition) => (
              <li
                key={competition.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 break-words font-display font-bold">
                  {competition.name}
                </span>
                <Button
                  size="sm"
                  disabled={busy || startDisabled || ended}
                  aria-label={t("modules.competitions.host.spotlight.show", {
                    name: competition.name,
                  })}
                  onClick={() =>
                    send({
                      type: "start_module",
                      module: "competitions",
                      competition: competition.position,
                    })
                  }
                >
                  {t("modules.competitions.host.spotlight.showShort")}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}
