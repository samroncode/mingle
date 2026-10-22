import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { useGuestWelcomes } from "./useGuestWelcomes";

/** Greets each new guest for a few seconds over the left side only. */
export function GuestWelcome({ members }: { members: MemberRow[] }) {
  const { t } = useTranslation();
  const welcome = useGuestWelcomes(members);
  if (!welcome) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80">
      <p
        role="status"
        data-testid="guest-welcome"
        className="rounded-3xl bg-primary px-12 py-8 text-center text-7xl font-semibold text-primary-foreground shadow-2xl"
      >
        {t("tv.welcomeGuest", { name: welcome.name })}
      </p>
    </div>
  );
}
