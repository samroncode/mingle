import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { CopyButton } from "@/components/CopyButton";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { guestAddress, tvAddress } from "@/lib/links";
import { SideGuests } from "./SideGuests";
import { SideMessage } from "./SideMessage";
import { TvMirror } from "./TvMirror";

interface SideColumnProps {
  event: EventRow;
  members: MemberRow[];
  hostKey: string;
  ended: boolean;
}

/**
 * The right column, "next to the TV": the event code and links, a small copy
 * of the TV, the guests and a field to message them. Flat: thin lines between
 * the parts; the mirror's own frame is the only surface.
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
  const origin = window.location.origin;
  const tv = tvAddress(origin, event.code);
  if (!wide) return null;
  return (
    <div className="flex flex-col gap-5 [&>*:not(:first-child)]:border-t-[length:var(--border-thin)] [&>*:not(:first-child)]:border-line [&>*:not(:first-child)]:pt-5">
      <section
        data-testid="side-code"
        aria-label={t("links.codeLabel")}
        className="space-y-2"
      >
        <p className="text-sm text-ink-muted">{t("links.codeLabel")}</p>
        <p
          data-testid="side-event-code"
          className="font-display text-4xl font-extrabold tracking-widest"
        >
          {event.code}
        </p>
        <ul className="space-y-2">
          <li className="flex items-center justify-between gap-2">
            <span className="text-sm">{t("hostPanel.side.guestLink")}</span>
            <CopyButton
              size="sm"
              text={guestAddress(origin, event.code)}
              label={t("hostPanel.side.copyGuest")}
            />
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-sm">{t("links.tvLabel")}</span>
            <span className="flex gap-2">
              <CopyButton size="sm" text={tv} label={t("links.copyTv")} />
              <Button asChild variant="outline" size="sm">
                <a href={tv} target="_blank" rel="noreferrer">
                  {t("hostPanel.side.openTv")}
                </a>
              </Button>
            </span>
          </li>
        </ul>
      </section>
      <section aria-label={t("hostPanel.mirror.title")} className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted">
          {t("hostPanel.mirror.title")}
        </h2>
        <TvMirror event={event} members={members} />
      </section>
      <SideGuests
        code={event.code}
        hostKey={hostKey}
        members={members}
        language={event.language}
        ended={ended}
      />
      {!ended && <SideMessage code={event.code} hostKey={hostKey} />}
    </div>
  );
}
