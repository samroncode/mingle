import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SideNext } from "./SideNext";
import { SideMessage } from "./SideMessage";
import { TvMirror } from "./TvMirror";

interface SideColumnProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  ended: boolean;
}

/**
 * The right column of Run: a small copy of the TV, the next program point and
 * a field to message the guests. Flat: thin lines between the parts; the
 * mirror's own frame is the only surface. After the evening only the TV.
 */
export function SideColumn({
  event,
  members,
  hostKey,
  ended,
}: SideColumnProps) {
  const { t } = useTranslation();
  // The column is for wide screens; on a phone it is not built at all, so the
  // mirror does no work there.
  const wide = useMediaQuery("(min-width: 1024px)");
  if (!wide) return null;
  return (
    <div className="flex flex-col gap-5 [&>*:not(:first-child)]:border-t-[length:var(--border-thin)] [&>*:not(:first-child)]:border-line [&>*:not(:first-child)]:pt-5">
      <section aria-label={t("hostPanel.mirror.title")} className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t("hostPanel.mirror.title")}
        </h2>
        <TvMirror event={event} members={members} />
      </section>
      {!ended && <SideNext event={event} />}
      {!ended && <SideMessage code={event.code} hostKey={hostKey} />}
    </div>
  );
}
