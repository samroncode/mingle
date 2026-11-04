import { useTranslation } from "react-i18next";
import type { Party } from "@/lib/schemas/party";
import { AwardDots } from "@/modules/AwardDots";
import { useWinnerCongrats } from "./useWinnerCongrats";

/**
 * Congratulates each new winner for a few seconds over the left side only,
 * as a diploma: the title in serif, a brass line, then the name.
 */
export function WinnerCongrats({ party }: { party: Party }) {
  const { t } = useTranslation();
  const winner = useWinnerCongrats(party);
  if (!winner) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
      <div
        role="status"
        data-testid="winner-congrats"
        className="fun-pop relative flex flex-col items-center gap-(--space-5) overflow-hidden rounded-xl border-[length:var(--border-thin)] border-edge bg-award px-(--space-8) py-(--space-7) text-center text-on-award"
      >
        <AwardDots />
        <p className="relative font-serif text-6xl">{winner.title}</p>
        <span aria-hidden className="relative h-px w-24 bg-champagne" />
        <p className="relative font-body text-7xl font-light tracking-wide">
          {t("tv.congratulations", { name: winner.name })}
        </p>
      </div>
    </div>
  );
}
