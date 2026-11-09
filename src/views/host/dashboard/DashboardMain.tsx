import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import type { HostLinkParts } from "@/lib/host/host-door";
import { EventLinks } from "@/components/EventLinks";
import { BrightRoom } from "../BrightRoom";
import { EndEvent } from "../EndEvent";
import { Guests } from "../Guests";
import { Messages } from "../Messages";
import { NowPanel } from "../NowPanel";
import { PartyScreen } from "../PartyScreen";
import { Winners } from "../Winners";
import { ActivitiesRow } from "./ActivitiesRow";
import { CostsBlock } from "./CostsBlock";
import { DashSection } from "./DashSection";
import { ProgramBlock } from "./ProgramBlock";

interface DashboardMainProps {
  eventId: string;
  link: HostLinkParts;
  event: EventRow;
  members: MemberRow[];
  ended: boolean;
  onEnded: () => void;
}

/**
 * The work area of the desktop dashboard: what runs now, the activities in
 * one row, the program and costs side by side, then the rest of what the
 * panel can do.
 */
export function DashboardMain({
  eventId,
  link,
  event,
  members,
  ended,
  onEnded,
}: DashboardMainProps) {
  const { t } = useTranslation();
  const hostKey = link.key;
  return (
    <div data-testid="dashboard-main" className="space-y-5 pb-[50svh]">
      <div id="dash-live" className="scroll-mt-28">
        <NowPanel
          event={event}
          members={members}
          hostKey={hostKey}
          ended={ended}
        />
      </div>
      {ended ? (
        <p className="rounded-md border-[length:var(--border-thin)] border-edge bg-champagne p-4 font-display text-xl font-bold text-on-bright">
          {t("hostPanel.ended")}
        </p>
      ) : (
        <DashSection
          section="activities"
          title={t("hostPanel.dashboard.nav.activities")}
        >
          <ActivitiesRow event={event} members={members} hostKey={hostKey} />
        </DashSection>
      )}
      <div className="grid gap-8 xl:grid-cols-2">
        <DashSection
          section="program"
          title={t("hostPanel.dashboard.nav.program")}
        >
          <ProgramBlock event={event} hostKey={hostKey} />
        </DashSection>
        <DashSection section="costs" title={t("hostPanel.dashboard.nav.costs")}>
          <CostsBlock event={event} members={members} hostKey={hostKey} />
        </DashSection>
      </div>
      {!ended && (
        <DashSection section="messages">
          <Messages
            eventId={eventId}
            code={event.code}
            hostKey={hostKey}
            language={event.language}
            noticesVersion={event.notices_version}
          />
        </DashSection>
      )}
      <DashSection section="guests">
        <Guests
          code={event.code}
          hostKey={hostKey}
          members={members}
          language={event.language}
          ended={ended}
        />
      </DashSection>
      {!ended && (
        <DashSection section="party">
          <PartyScreen event={event} hostKey={hostKey} />
          <Winners event={event} hostKey={hostKey} />
        </DashSection>
      )}
      <DashSection section="event" title={t("hostPanel.event")}>
        {!ended && <BrightRoom event={event} hostKey={hostKey} />}
        <EventLinks code={link.code} hostKey={link.key} hideHostLink />
        {!ended && (
          <EndEvent code={event.code} hostKey={hostKey} onEnded={onEnded} />
        )}
      </DashSection>
    </div>
  );
}

export type { DashboardMainProps };
