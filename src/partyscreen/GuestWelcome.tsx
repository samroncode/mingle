import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { useGuestWelcomes } from "./useGuestWelcomes";

/** Greets each new guest for a few seconds over the left side only. */
export function GuestWelcome({ members }: { members: MemberRow[] }) {
  const { t } = useTranslation();
  const welcome = useGuestWelcomes(members);
  if (!welcome) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80">
      <p
        role="status"
        data-testid="guest-welcome"
        className="fun-pop -rotate-2 rounded-xl border-[length:var(--border-thin)] border-edge bg-coral px-(--space-7) py-(--space-6) text-center font-display text-8xl font-extrabold text-on-bright"
      >
        {t("tv.welcomeGuest", { name: welcome.name })}
      </p>
    </div>
  );
}
