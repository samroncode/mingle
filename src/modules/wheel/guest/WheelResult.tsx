import { useTranslation } from "react-i18next";
import type { WheelSpinView } from "@/api/wheel";
import { cn } from "@/lib/utils";
import { Confetti } from "../../Confetti";

/**
 * The latest draw on a phone. When the guest was drawn it says so in the
 * biggest text; otherwise it names who was drawn.
 */
export function WheelResult({
  spin,
  mine,
}: {
  spin: WheelSpinView;
  mine: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      key={spin.id}
      data-testid="wheel-result"
      data-mine={mine}
      className={cn(
        "fun-pop relative space-y-2 rounded-lg border-[length:var(--border-thick)] border-edge p-5 text-center shadow-pop-md",
        mine ? "bg-coral text-on-coral" : "bg-paper text-on-paper",
      )}
    >
      {mine && <Confetti />}
      {mine && (
        <p
          data-testid="wheel-its-you"
          className="font-display text-4xl leading-none font-extrabold"
        >
          {t("modules.wheel.guest.itsYou")}
        </p>
      )}
      <p className="text-sm font-bold tracking-wide uppercase">
        {t("modules.wheel.guest.drawn")}
      </p>
      <p className="font-display text-4xl leading-tight font-extrabold break-words">
        {spin.label}
      </p>
    </div>
  );
}
