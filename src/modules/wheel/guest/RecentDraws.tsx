import { useTranslation } from "react-i18next";
import type { WheelSpinView } from "@/api/wheel";

/** The last few draws, newest first. */
export function RecentDraws({ spins }: { spins: WheelSpinView[] }) {
  const { t } = useTranslation();
  if (spins.length === 0) return null;
  return (
    <section data-testid="wheel-recent" className="space-y-2">
      <h3 className="font-display text-xl font-bold">
        {t("modules.wheel.guest.recent")}
      </h3>
      <ol className="space-y-2">
        {spins.map((spin) => (
          <li
            key={spin.id}
            className="flex items-baseline gap-3 rounded-md border-[length:var(--border-thin)] border-edge bg-paper px-3 py-2 text-on-paper"
          >
            <span className="font-display font-bold">{spin.number}</span>
            <span className="break-words">{spin.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
