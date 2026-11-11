import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { EventLinks } from "@/components/EventLinks";
import { FlatSections, PanelSection } from "@/components/PanelSection";
import type { HostLinkParts } from "@/lib/host/host-door";
import type { PrepareSection } from "@/lib/host/panel-view";
import { Activities } from "../Activities";
import { BrightRoom } from "../BrightRoom";
import { EndEvent } from "../EndEvent";
import { Guests } from "../Guests";
import { Messages } from "../Messages";
import { PartyScreen } from "../PartyScreen";
import { SharedCosts } from "../SharedCosts";
import { Winners } from "../Winners";

interface PrepareViewProps {
  eventId: string;
  link: HostLinkParts;
  event: EventRow;
  members: MemberRow[];
  ended: boolean;
  onEnded: () => void;
  /** The section the URL asked for, if it named one. */
  focus?: PrepareSection;
}

/** The test id of the element a section lives in, for opening it from a link. */
function sectionTestId(section: PrepareSection): string {
  switch (section) {
    case "party":
    case "program":
      return "party-screen";
    case "costs":
      return "host-costs";
    case "guests":
      return "host-guests";
    case "messages":
      return "host-messages";
    case "winners":
      return "host-winners";
    case "brightroom":
      return "bright-room";
    case "links":
    case "end":
      return "event-section";
    default:
      return `activity-${section}`;
  }
}

/** Opens and scrolls to the section the link asked for. */
function useFocusSection(focus: PrepareSection | undefined) {
  // StrictMode runs effects twice; a second click would shut the section.
  const done = useRef<PrepareSection>(undefined);
  useEffect(() => {
    if (!focus || done.current === focus) return;
    done.current = focus;
    const element = document.querySelector(
      `[data-testid="${sectionTestId(focus)}"]`,
    );
    if (!element) return;
    const header = element.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    );
    header?.click();
    element.scrollIntoView({ block: "start" });
  }, [focus]);
}

/**
 * Prepare: everything the host changes. For now today's phone list of
 * sections at every width; the Prepare ticket redesigns it as a section list
 * with one editor beside it.
 */
export function PrepareView({
  eventId,
  link,
  event,
  members,
  ended,
  onEnded,
  focus,
}: PrepareViewProps) {
  const { t } = useTranslation();
  useFocusSection(focus);
  return (
    <div data-testid="prepare-view" className="space-y-6 pt-4">
      <FlatSections value>
        {ended ? (
          <p className="rounded-md border-[length:var(--border-thin)] border-edge bg-champagne p-4 font-display text-xl font-bold text-on-bright">
            {t("hostPanel.ended")}
          </p>
        ) : (
          <Activities event={event} members={members} hostKey={link.key} />
        )}
        {!ended && <PartyScreen event={event} hostKey={link.key} />}
        {!ended && <Winners event={event} hostKey={link.key} />}
        {!ended && <BrightRoom event={event} hostKey={link.key} />}
        <Guests
          code={event.code}
          hostKey={link.key}
          members={members}
          language={event.language}
          ended={ended}
        />
        <SharedCosts
          eventId={eventId}
          code={event.code}
          hostKey={link.key}
          members={members}
          language={event.language}
          costsVersion={event.costs_version}
        />
        {!ended && (
          <Messages
            eventId={eventId}
            code={event.code}
            hostKey={link.key}
            language={event.language}
            noticesVersion={event.notices_version}
          />
        )}
        <PanelSection
          testId="event-section"
          title={t("hostPanel.event")}
          summary={t("hostPanel.summary.event")}
        >
          <EventLinks code={link.code} hostKey={link.key} hideHostLink />
          {!ended && (
            <EndEvent code={event.code} hostKey={link.key} onEnded={onEnded} />
          )}
        </PanelSection>
      </FlatSections>
    </div>
  );
}
