import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { guestNames, stripNames } from "./guests";

/** How many name chips fit along the bottom of the TV. */
const MAX_CHIPS = 10;

/** The bottom line of the party screen: who is here tonight, as name chips. */
export function GuestStrip({ members }: { members: MemberRow[] }) {
  const { t } = useTranslation();
  const { shown, hidden } = stripNames(guestNames(members), MAX_CHIPS);
  if (shown.length === 0) return null;
  return (
    <section
      aria-label={t("tv.hereTonight")}
      className="flex items-center gap-(--space-3) overflow-hidden border-t-[length:var(--border-thin)] border-line pt-(--space-4)"
    >
      <h2 className="mr-(--space-2) shrink-0 font-body text-2xl text-ink-muted">
        {t("tv.hereTonight")}
      </h2>
      <ul data-testid="guest-strip" className="flex min-w-0 gap-(--space-3)">
        {shown.map((name, index) => (
          <li
            key={index}
            className="max-w-[14ch] truncate rounded-sm border-[length:var(--border-thin)] border-edge bg-paper px-(--space-3) py-(--space-1) font-display text-2xl font-bold text-on-paper"
          >
            {name}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="shrink-0 font-display text-2xl font-bold text-ink-muted">
          {t("tv.moreGuests", { count: hidden })}
        </p>
      )}
    </section>
  );
}
