import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { hasLive } from "./hasLive";
import { RunningLive } from "./RunningLive";
import { TvNow } from "./TopBar";

interface NowPanelProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  /** The evening has ended: nothing runs, so the panel is hidden. */
  ended?: boolean;
  /** Phone: the heading says what the TV shows, and the actions sit in the bottom bar. */
  phone?: boolean;
}

/**
 * What is running now, first on the page: the running activity's `Live`
 * controls, or a calm line when nothing runs. Hidden after the evening ended.
 */
export function NowPanel({
  event,
  members,
  hostKey,
  ended,
  phone,
}: NowPanelProps) {
  const { t } = useTranslation();
  if (ended || event.status === "ended") return null;
  const live = hasLive(event);
  return (
    <section
      data-testid="now-panel"
      aria-label={t("hostPanel.now.title")}
      className={
        phone ? "space-y-3 pt-4" : "space-y-2 [&_button]:w-auto [&_button]:px-8"
      }
    >
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
        {phone && live ? (
          <span data-testid="tv-now">
            {t("hostPanel.tvNow")} <TvNow event={event} />
          </span>
        ) : (
          t("hostPanel.now.title")
        )}
      </h2>
      {live ? (
        <RunningLive
          event={event}
          members={members}
          code={event.code}
          hostKey={hostKey}
          startDisabled={false}
          part={phone ? "status" : "all"}
        />
      ) : (
        <p data-testid="now-empty" className="text-ink-muted">
          {t("hostPanel.now.empty")}
        </p>
      )}
    </section>
  );
}
