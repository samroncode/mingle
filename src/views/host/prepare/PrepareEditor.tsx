import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { BareSections } from "@/components/PanelSection";
import { EventLinks } from "@/components/EventLinks";
import type { HostLinkParts } from "@/lib/host/host-door";
import type { PrepareSection } from "@/lib/host/panel-view";
import { isModuleId } from "@/modules/registry";
import { BrightRoom } from "../BrightRoom";
import { EndEvent } from "../EndEvent";
import { Guests } from "../Guests";
import { Messages } from "../Messages";
import { PartyScreen } from "../PartyScreen";
import { SharedCosts } from "../SharedCosts";
import { Winners } from "../Winners";
import { ProgramBlock } from "./ProgramBlock";
import { ActivityEditor } from "./ActivityEditor";

interface PrepareEditorProps {
  section: PrepareSection;
  eventId: string;
  link: HostLinkParts;
  event: EventRow;
  members: MemberRow[];
  ended: boolean;
  onEnded: () => void;
}

function SectionBody({
  section,
  eventId,
  link,
  event,
  members,
  ended,
  onEnded,
}: PrepareEditorProps) {
  const hostKey = link.key;
  switch (section) {
    case "party":
      return <PartyScreen event={event} hostKey={hostKey} />;
    case "program":
      return <ProgramBlock event={event} hostKey={hostKey} />;
    case "costs":
      return (
        <SharedCosts
          eventId={eventId}
          code={event.code}
          hostKey={hostKey}
          members={members}
          language={event.language}
          costsVersion={event.costs_version}
        />
      );
    case "guests":
      return (
        <Guests
          code={event.code}
          hostKey={hostKey}
          members={members}
          language={event.language}
          ended={ended}
        />
      );
    case "messages":
      return (
        <Messages
          eventId={eventId}
          code={event.code}
          hostKey={hostKey}
          language={event.language}
          noticesVersion={event.notices_version}
        />
      );
    case "winners":
      return <Winners event={event} hostKey={hostKey} />;
    case "links":
      return (
        <div data-testid="event-section">
          <EventLinks code={link.code} hostKey={hostKey} hideHostLink />
        </div>
      );
    case "brightroom":
      return <BrightRoom event={event} hostKey={hostKey} flat />;
    case "end":
      return <EndEvent code={event.code} hostKey={hostKey} onEnded={onEnded} />;
    default:
      return null;
  }
}

/**
 * The one open editor of Prepare. Every section but the activities renders
 * the component that does that job, under a heading with the section's name;
 * the section list is the navigation, so nothing here folds.
 */
export function PrepareEditor(props: PrepareEditorProps) {
  const { t } = useTranslation();
  const { section, event, members, link } = props;
  return (
    <div
      data-testid="prepare-editor"
      data-section={section}
      className="max-w-2xl space-y-4"
    >
      <BareSections value>
        {isModuleId(section) ? (
          <ActivityEditor
            id={section}
            event={event}
            members={members}
            hostKey={link.key}
          />
        ) : (
          <section aria-labelledby="prepare-editor-title" className="space-y-4">
            <h2
              id="prepare-editor-title"
              className="font-display text-2xl font-bold"
            >
              {t(`hostPanel.prepare.sections.${section}`)}
            </h2>
            <SectionBody {...props} />
          </section>
        )}
      </BareSections>
    </div>
  );
}
