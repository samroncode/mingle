import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import type { WheelEntryView } from "@/api/wheel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { TvStage } from "../../TvStage";
import type { ModuleViewProps } from "../../types";
import { useWheelEntries } from "../useWheelEntries";
import { useTvSpin } from "./useTvSpin";
import { useWheelRun } from "./useWheelRun";
import { WheelSvg } from "./WheelSvg";

/** What a wedge says: the guest's current name, or the host's own text. */
function entryLabel(entry: WheelEntryView, members: MemberRow[]): string {
  if (entry.kind === "custom") return entry.label ?? "";
  return members.find((m) => m.user_id === entry.memberId)?.display_name ?? "";
}

/** The fewest entries a wheel can be spun with. */
const fewest = 2;

/**
 * The TV while the Lucky wheel runs: a big wheel with one wedge per entry that
 * turns when the host spins, then the winner large. The wheel follows the
 * entries live; a later viewer sees the latest result without the spin.
 */
export function WheelTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { entries } = useWheelEntries(event.id);
  const spin = useTvSpin(event.id);
  const run = useWheelRun(spin, entries, reduced);

  const labels = run.wheel
    .filter((e) => e.kind === "custom" || entryLabel(e, members) !== "")
    .map((e) => entryLabel(e, members));
  const ready = entries.status === "ready";
  const waiting = ready && labels.length < fewest && !run.spinning;

  return (
    <TvStage
      data-testid="wheel-tv"
      moment={run.result !== undefined}
      momentKey={run.result?.id ?? ""}
    >
      {waiting ? (
        <p
          data-testid="wheel-tv-waiting"
          className="text-center font-display text-5xl font-extrabold"
        >
          {t("modules.wheel.tv.waiting")}
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-(--space-7)">
          <div className="h-full min-h-0 flex-1 py-2">
            <div className="mx-auto flex h-full justify-center">
              <WheelSvg
                labels={labels}
                rotation={run.rotation}
                durationMs={run.durationMs}
                label={t("modules.wheel.tv.wheelLabel", {
                  count: labels.length,
                })}
              />
            </div>
          </div>
          <div
            role="status"
            data-testid="wheel-tv-result"
            className="flex w-2/5 flex-col gap-4"
          >
            {run.spinning && (
              <p className="font-display text-5xl font-extrabold">
                {t("modules.wheel.tv.spinning")}
              </p>
            )}
            {run.result && (
              <>
                <p className="font-display text-3xl font-bold tracking-wide text-champagne-text uppercase">
                  {t("modules.wheel.tv.drawn", { number: run.result.number })}
                </p>
                <p
                  data-testid="wheel-tv-winner"
                  className="font-display text-8xl leading-tight font-extrabold break-words"
                >
                  {run.result.label}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </TvStage>
  );
}
