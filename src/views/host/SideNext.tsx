import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { nextProgramPoint } from "@/lib/host/next-program";
import { readParty } from "@/lib/party";

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** The next program point that has not started. Renders nothing when none. */
export function SideNext({ event }: { event: EventRow }) {
  const { t } = useTranslation();
  const next = nextProgramPoint(
    readParty(event.party).schedule ?? [],
    minutesNow(),
  );
  if (!next) return null;
  return (
    <section data-testid="side-next" aria-label={t("hostPanel.side.nextTitle")}>
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
        {t("hostPanel.side.nextTitle")}
      </h2>
      <p className="mt-2 flex items-baseline gap-3">
        <span className="font-display text-3xl font-extrabold">
          {next.time}
        </span>
        <span className="min-w-0 break-words text-ink">{next.title}</span>
      </p>
    </section>
  );
}
