import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { EventRow, MemberRow } from "@/api/events";
import { useIsPhone } from "@/hooks/useIsPhone";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import type { HostLinkParts } from "@/lib/host/host-door";
import { currentSection, prepareGroups } from "@/lib/host/prepare-sections";
import { PrepareEditor } from "./PrepareEditor";
import { PrepareList } from "./PrepareList";

interface PrepareViewProps {
  eventId: string;
  link: HostLinkParts;
  event: EventRow;
  members: MemberRow[];
  ended: boolean;
  onEnded: () => void;
}

/**
 * Prepare: everything the host changes. A list of sections with one editor:
 * side by side on a wide screen, and on a phone the list is the page and a
 * section opens as its own page with a back link. The section is in the URL.
 */
export function PrepareView({
  eventId,
  link,
  event,
  members,
  ended,
  onEnded,
}: PrepareViewProps) {
  const { t } = useTranslation();
  const phone = useIsPhone();
  const location = usePanelLocation();
  const groups = prepareGroups(event.enabled_modules, ended);
  const current = currentSection(groups, location.section);
  const chosen = location.hasSection && current === location.section;
  const showList = !phone || !chosen;
  const showEditor = current && (!phone || chosen);
  return (
    <div data-testid="prepare-view" className="space-y-6 pt-4">
      {ended && (
        <p className="rounded-md border-[length:var(--border-thin)] border-edge bg-champagne p-4 font-display text-xl font-bold text-on-bright">
          {t("hostPanel.ended")}
        </p>
      )}
      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
        {showList && (
          <div className="lg:self-start">
            <PrepareList
              event={event}
              groups={groups}
              current={phone ? undefined : current}
            />
          </div>
        )}
        {showEditor && (
          <div className="space-y-4">
            {phone && (
              <Link
                to={location.to("prepare")}
                replace
                data-testid="prepare-back"
                className="inline-flex min-h-12 items-center gap-1 font-display font-bold"
              >
                <ChevronLeft aria-hidden className="size-5" />
                {t("hostPanel.prepare.back")}
              </Link>
            )}
            <PrepareEditor
              key={current}
              section={current}
              eventId={eventId}
              link={link}
              event={event}
              members={members}
              ended={ended}
              onEnded={onEnded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
