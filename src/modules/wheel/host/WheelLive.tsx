import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  setFlow,
  updateWheel,
  type HostActionResult,
} from "@/api/host-actions";
import { clearSpins, setAutoTakeOff, spinWheel } from "@/api/wheel";
import { ErrorLine } from "@/components/ErrorLine";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useHostAction } from "@/hooks/useHostAction";
import { wheelErrorKey } from "@/lib/host/wheel-errors";
import type { ModuleLiveProps } from "../../types";
import { useWheelEntries } from "../useWheelEntries";
import { announceSpinsChanged, useWheelSpins } from "../useWheelSpins";

/**
 * How long the TV and phones animate a spin. The host's Spin button stays
 * busy for this long so a new spin never starts over a running animation.
 */
export const spinAnimationMs = 6000;

/** The most spins listed at once; older ones are behind "Clear list". */
const listedSpins = 10;

/**
 * The running Lucky wheel: Spin, the latest result with one-tap take-off, the
 * automatic take-off setting, this evening's draws and Stop. Renders nothing
 * while the wheel is not the running activity.
 */
export function WheelLive({
  event,
  code,
  hostKey,
  part = "all",
}: ModuleLiveProps) {
  const { t } = useTranslation();
  const running = event.current_module === "wheel";
  const { entries, reload } = useWheelEntries(event.id, running);
  const spins = useWheelSpins(event.id);
  const spin = useHostAction(wheelErrorKey, "host");
  const other = useHostAction(wheelErrorKey, "host");
  const [animating, setAnimating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!running) return null;

  const list = entries.status === "ready" ? entries.value : [];
  const onWheel = list.filter((e) => e.state === "on").length;
  const history = spins.status === "ready" ? spins.value : [];
  const latest = history[0];
  const drawn = list.find((e) => e.id === latest?.entryId);
  const canTakeOff = drawn?.state === "on";
  const link = { code, key: hostKey };
  const tooFew = onWheel < 2;
  const blocked = spin.busy || animating || tooFew || event.status === "ended";

  async function doSpin() {
    const result = await spin.run(() => spinWheel(link), "wheel_spin");
    if (!result.ok) return;
    announceSpinsChanged();
    setAnimating(true);
    timer.current = setTimeout(() => setAnimating(false), spinAnimationMs);
  }

  async function change(
    call: () => Promise<HostActionResult<unknown>>,
    action: string,
  ) {
    const result = await other.run(call, action);
    if (!result.ok) return;
    reload();
    announceSpinsChanged();
  }

  return (
    <div data-testid="wheel-live" className="space-y-3">
      {part !== "actions" && (
        <>
          <ResultCard
            label={latest?.label}
            number={latest?.number}
            canTakeOff={canTakeOff}
            disabled={other.busy}
            onTakeOff={() =>
              drawn &&
              void change(
                () =>
                  updateWheel({
                    ...link,
                    change: { type: "take_off", id: drawn.id },
                  }),
                "wheel_take_off",
              )
            }
          />
          <div className="flex items-center justify-between gap-3">
            <span id="wheel-auto-label" className="font-bold">
              {t("modules.wheel.live.auto")}
            </span>
            <Switch
              aria-labelledby="wheel-auto-label"
              checked={event.wheel_auto_take_off}
              disabled={other.busy}
              onCheckedChange={(enabled) =>
                void change(
                  () => setAutoTakeOff(link, enabled),
                  "wheel_auto_take_off",
                )
              }
            />
          </div>
          <SpinList
            spins={history.slice(0, listedSpins)}
            disabled={other.busy}
            onClear={() =>
              void change(() => clearSpins(link), "wheel_clear_spins")
            }
          />
        </>
      )}
      {part !== "status" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="lg"
              className="min-w-40 flex-1"
              disabled={blocked}
              onClick={() => void doSpin()}
            >
              {t(
                animating
                  ? "modules.wheel.live.spinning"
                  : "modules.wheel.live.spin",
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={other.busy}
              onClick={() =>
                void change(
                  () =>
                    setFlow({
                      ...link,
                      move: { type: "stop_module" },
                    }),
                  "wheel_stop_module",
                )
              }
            >
              {t("modules.wheel.live.stop")}
            </Button>
          </div>
          {tooFew && (
            <p
              data-testid="wheel-spin-reason"
              className="text-sm text-ink-muted"
            >
              {t("modules.wheel.live.tooFew")}
            </p>
          )}
        </div>
      )}
      {spin.error && <ErrorLine>{spin.error}</ErrorLine>}
      {other.error && <ErrorLine>{other.error}</ErrorLine>}
    </div>
  );
}

function ResultCard({
  label,
  number,
  canTakeOff,
  disabled,
  onTakeOff,
}: {
  label: string | undefined;
  number: number | undefined;
  canTakeOff: boolean;
  disabled: boolean;
  onTakeOff: () => void;
}) {
  const { t } = useTranslation();
  if (label === undefined) {
    return (
      <p data-testid="wheel-no-result" className="text-sm text-ink-muted">
        {t("modules.wheel.live.noSpins")}
      </p>
    );
  }
  return (
    <div data-testid="wheel-result" className="space-y-2">
      <p className="text-sm text-ink-muted">
        {t("modules.wheel.live.latest", { number })}
      </p>
      <p className="font-display text-2xl font-bold break-words">{label}</p>
      {canTakeOff && (
        <Button variant="outline" disabled={disabled} onClick={onTakeOff}>
          {t("modules.wheel.live.takeOff")}
        </Button>
      )}
    </div>
  );
}

function SpinList({
  spins,
  disabled,
  onClear,
}: {
  spins: Array<{ id: string; number: number; label: string }>;
  disabled: boolean;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  if (spins.length === 0) return null;
  return (
    <div data-testid="wheel-spins" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold">
          {t("modules.wheel.live.drawnTitle")}
        </h3>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
          {t("modules.wheel.live.clear")}
        </Button>
      </div>
      <ol className="space-y-1">
        {spins.map((spin) => (
          <li key={spin.id} className="flex gap-2">
            <span className="w-8 text-ink-muted">{spin.number}.</span>
            <span className="min-w-0 flex-1 break-words">{spin.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
