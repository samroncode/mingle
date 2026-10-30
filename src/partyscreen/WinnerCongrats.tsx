import { useTranslation } from "react-i18next";
import type { Party } from "@/lib/schemas/party";
import { useWinnerCongrats } from "./useWinnerCongrats";

/** Congratulates each new winner for a few seconds over the left side only. */
export function WinnerCongrats({ party }: { party: Party }) {
  const { t } = useTranslation();
  const winner = useWinnerCongrats(party);
  if (!winner) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
      <div
        role="status"
        data-testid="winner-congrats"
        className="fun-pop -rotate-2 rounded-xl border-[length:var(--border-thin)] border-edge bg-coral px-(--space-7) py-(--space-6) text-center font-display font-extrabold text-on-bright"
      >
        <p className="text-8xl">
          {t("tv.congratulations", { name: winner.name })}
        </p>
        <p className="mt-(--space-4) text-5xl">{winner.title}</p>
      </div>
    </div>
  );
}
