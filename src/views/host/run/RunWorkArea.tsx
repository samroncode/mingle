import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { ActivitiesRow } from "../dashboard/ActivitiesRow";
import { NowPanel } from "../NowPanel";

interface RunWorkAreaProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  ended: boolean;
  phone: boolean;
}

/**
 * Run, the work area: what runs now and the activities to start. Owned by the
 * Run overview ticket; it holds today's Now panel and a start-only row for now.
 */
export function RunWorkArea({
  event,
  members,
  hostKey,
  ended,
  phone,
}: RunWorkAreaProps) {
  const { t } = useTranslation();
  return (
    <div data-testid="run-work-area" className="space-y-5">
      <NowPanel
        event={event}
        members={members}
        hostKey={hostKey}
        ended={ended}
        phone={phone}
      />
      {ended ? (
        <p className="rounded-md border-[length:var(--border-thin)] border-edge bg-champagne p-4 font-display text-xl font-bold text-on-bright">
          {t("hostPanel.ended")}
        </p>
      ) : (
        <section aria-label={t("hostPanel.dashboard.nav.activities")}>
          <ActivitiesRow
            event={event}
            members={members}
            hostKey={hostKey}
            startOnly
          />
        </section>
      )}
    </div>
  );
}
