import { useTranslation } from "react-i18next";
import type { WheelSpinView } from "@/api/wheel";
import { revealedSpins } from "@/lib/wheel/reveal";
import type { ModuleGuestViewProps } from "../../types";
import { useWheelEntries } from "../useWheelEntries";
import { useWheelSpins } from "../useWheelSpins";
import { RecentDraws } from "./RecentDraws";
import { useRevealClock } from "./useRevealClock";
import { WheelResult } from "./WheelResult";

/** How many draws the phone lists. */
const RECENT_COUNT = 5;
const NO_SPINS: WheelSpinView[] = [];

/**
 * The guest page while the Lucky wheel runs: the latest result once the TV's
 * animation is over, the recent draws, and a highlight when it is you. Guests
 * cannot change anything here.
 */
export function WheelGuest({ event, userId }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const { entries, reload: reloadEntries } = useWheelEntries(event.id);
  const { spins, reload: reloadSpins } = useWheelSpins(event.id);
  const all = spins.status === "ready" ? spins.value : NO_SPINS;
  const now = useRevealClock(all);

  const failed = entries.status === "error" || spins.status === "error";
  const ready = entries.status === "ready" && spins.status === "ready";
  const list = entries.status === "ready" ? entries.value : [];
  const mine = list.filter(
    (entry) => entry.kind === "guest" && entry.memberId === userId,
  );
  const onWheel = mine.some((entry) => entry.state === "on");
  const onCount = list.filter((entry) => entry.state === "on").length;

  const shown = revealedSpins(all, now);
  const latest = shown[0];
  // The entry may be taken off right after the draw, so match it by id, not by state.
  const drawnIsMe =
    latest !== undefined &&
    latest.entryId !== null &&
    mine.some((entry) => entry.id === latest.entryId);
  const spinning = all.length > shown.length;

  return (
    <section data-testid="wheel-guest" className="space-y-4">
      <p className="font-display text-3xl font-extrabold">
        {t("modules.wheel.name")}
      </p>
      {failed && !ready && (
        <div role="alert" className="space-y-2">
          <p>{t("modules.wheel.guest.loadFailed")}</p>
          <button
            type="button"
            className="min-h-12 rounded-md border-[length:var(--border-thin)] border-edge px-4 font-bold"
            onClick={() => {
              reloadEntries();
              reloadSpins();
            }}
          >
            {t("modules.wheel.guest.retry")}
          </button>
        </div>
      )}
      {spinning && (
        <p data-testid="wheel-spinning" className="text-lg font-bold">
          {t("modules.wheel.guest.spinning")}
        </p>
      )}
      {latest && <WheelResult spin={latest} mine={drawnIsMe} />}
      {ready && !drawnIsMe && !spinning && (
        <p data-testid="wheel-status" className="text-ink-muted">
          {!onWheel
            ? t("modules.wheel.guest.notOnWheel")
            : onCount < 2
              ? t("modules.wheel.guest.waitingForHost")
              : latest
                ? t("modules.wheel.guest.nextSpin")
                : t("modules.wheel.guest.lookAtTv")}
        </p>
      )}
      <RecentDraws spins={shown.slice(0, RECENT_COUNT)} />
    </section>
  );
}
