import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { EventLinks } from "@/components/EventLinks";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { useHostEventId } from "@/hooks/useHostEventId";
import type { HostLinkParts } from "@/lib/host-door";
import { Activities } from "./Activities";
import { EndEvent } from "./EndEvent";
import { PartyScreen } from "./PartyScreen";
import { TopBar } from "./TopBar";

function Placeholder({ title }: { title: string }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold">{title}</h2>
    </section>
  );
}

function EventSection({
  link,
  children,
}: {
  link: HostLinkParts;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-2">
      <h2 className="font-semibold">{t("hostPanel.event")}</h2>
      <EventLinks code={link.code} hostKey={link.key} hideHostLink />
      {children}
    </section>
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
        className="text-muted-foreground"
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
        <p role="alert" className="text-sm text-destructive">
          {t("hostPanel.offline")}
        </p>
      )}
      {ended ? (
        <p className="font-medium">{t("hostPanel.ended")}</p>
      ) : (
        <Activities event={event} members={members} hostKey={link.key} />
      )}
      {!ended && <PartyScreen event={event} hostKey={link.key} />}
      <Placeholder title={t("hostPanel.guestsTitle")} />
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
        <p className="text-muted-foreground">{t("hostPanel.loading")}</p>
      )}
      {!eventId && <EventSection link={link} />}
    </div>
  );
}
