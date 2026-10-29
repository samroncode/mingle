import { ErrorLine } from "@/components/ErrorLine";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { EventLinks } from "@/components/EventLinks";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { useHostEventId } from "@/hooks/useHostEventId";
import type { HostLinkParts } from "@/lib/host/host-door";
import { Activities } from "./Activities";
import { EndEvent } from "./EndEvent";
import { Guests } from "./Guests";
import { PartyScreen } from "./PartyScreen";
import { SharedCosts } from "./SharedCosts";
import { TopBar } from "./TopBar";

function EventSection({
  link,
  children,
}: {
  link: HostLinkParts;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <h2 className="font-display text-xl font-bold">{t("hostPanel.event")}</h2>
      <EventLinks code={link.code} hostKey={link.key} hideHostLink />
      {children}
    </Card>
  );
}

function Live({ eventId, link }: { eventId: string; link: HostLinkParts }) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  useEventLanguage(state.event?.language);
  const { event, members } = state;
  // Right after End, until the snapshot catches up.
  const [endedHere, setEndedHere] = useState(false);

  if (!event) {
    return (
      <p
        role={state.status === "error" ? "alert" : undefined}
        className="text-ink-muted"
      >
        {t(
          state.status === "error"
            ? "hostPanel.loadFailed"
            : "hostPanel.loading",
        )}
      </p>
    );
  }
  const ended = event.status === "ended" || endedHere;
  return (
    <>
      <TopBar event={event} members={members} hostKey={link.key} />
      {state.status === "error" && (
        <ErrorLine>{t("hostPanel.offline")}</ErrorLine>
      )}
      {ended ? (
        <p className="rounded-md border-[length:var(--border-chunky)] border-edge bg-champagne p-4 font-display text-xl font-bold text-on-bright shadow-pop-sm">
          {t("hostPanel.ended")}
        </p>
      ) : (
        <Activities event={event} members={members} hostKey={link.key} />
      )}
      {!ended && <PartyScreen event={event} hostKey={link.key} />}
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
      />
      <EventSection link={link}>
        {!ended && (
          <EndEvent
            code={event.code}
            hostKey={link.key}
            onEnded={() => setEndedHere(true)}
          />
        )}
      </EventSection>
    </>
  );
}

/** The control panel after the claim: one scrolling page. */
export function HostPanel({ link }: { link: HostLinkParts }) {
  const { t } = useTranslation();
  const eventId = useHostEventId(link.code, true);
  return (
    <div className="space-y-6">
      {eventId ? (
        <Live eventId={eventId} link={link} />
      ) : (
        <p className="text-ink-muted">{t("hostPanel.loading")}</p>
      )}
      {!eventId && <EventSection link={link} />}
    </div>
  );
}
