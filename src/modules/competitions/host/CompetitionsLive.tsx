import { useTranslation } from "react-i18next";
import { setFlow } from "@/api/host-actions";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import { spotlightErrorKey } from "@/lib/host/competitions-errors";
import type { ModuleLiveProps } from "../../types";
import { useCompetitions } from "../useCompetitions";

/**
 * The competition table on the TV now, and Stop showing. Renders nothing
 * while no table is on the TV.
 */
export function CompetitionsLive({
  event,
  code,
  hostKey,
  part = "all",
}: ModuleLiveProps) {
  const { t } = useTranslation();
  const { competitions } = useCompetitions(event.id);
  const { busy, error, run } = useHostAction(spotlightErrorKey, "host");
  if (event.current_module !== "competitions") return null;
  const shown =
    competitions.status === "ready"
      ? competitions.value.find((c) => c.position === event.current_step)
      : undefined;

  return (
    <div data-testid="competitions-live" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {part !== "actions" && (
          <p
            data-testid="competitions-spotlight-state"
            className="min-w-0 flex-1 break-words text-sm"
          >
            {t("modules.competitions.host.spotlight.onTv", {
              name: shown?.name ?? t("modules.competitions.name"),
            })}
          </p>
        )}
        {part !== "status" && (
          <Button
            size="lg"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  setFlow({
                    code,
                    key: hostKey,
                    move: { type: "stop_module" },
                  }),
                "spotlight_stop_module",
              )
            }
          >
            {t("modules.competitions.host.spotlight.stop")}
          </Button>
        )}
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  );
}
