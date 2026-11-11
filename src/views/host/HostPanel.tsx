import { ErrorLine } from "@/components/ErrorLine";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PanelSection } from "@/components/PanelSection";
import { EventLinks } from "@/components/EventLinks";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useIsPhone } from "@/hooks/useIsPhone";
import { usePanelLocation } from "@/hooks/usePanelLocation";
import { useEventState } from "@/hooks/useEventState";
import { useHostEventId } from "@/hooks/useHostEventId";
import type { HostLinkParts } from "@/lib/host/host-door";
import { BottomBar } from "./BottomBar";
import { HostFrame } from "./HostFrame";
import { SideColumn } from "./SideColumn";
import { PrepareView } from "./prepare/PrepareView";
import { RunWorkArea } from "./run/RunWorkArea";
import { TopBar } from "./TopBar";
import { ViewSwitch } from "./ViewSwitch";

function EventSection({
  link,
  defaultOpen,
  children,
}: {
  link: HostLinkParts;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <PanelSection
      testId="event-section"
      title={t("hostPanel.event")}
      summary={t("hostPanel.summary.event")}
      defaultOpen={defaultOpen}
    >
      <EventLinks code={link.code} hostKey={link.key} hideHostLink />
      {children}
    </PanelSection>
  );
}

function Live({ eventId, link }: { eventId: string; link: HostLinkParts }) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  useEventLanguage(state.event?.language);
  const { event, members } = state;
  // Right after End, until the snapshot catches up.
  const [endedHere, setEndedHere] = useState(false);
  const phone = useIsPhone();
  const location = usePanelLocation();

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
  const run = location.view === "run";
  const barShown = phone && run && !ended && !!event.current_module;
  const hostKey = link.key;
  let padding: string | undefined;
  if (phone) padding = barShown ? "pb-48" : "pb-24";
  return (
    <div className={padding}>
      <TopBar event={event} members={members} />
      {state.status === "error" && (
        <ErrorLine>{t("hostPanel.offline")}</ErrorLine>
      )}
      {run ? (
        <HostFrame
          main={
            <RunWorkArea
              event={event}
              members={members}
              hostKey={hostKey}
              ended={ended}
              phone={phone}
            />
          }
          side={
            <SideColumn
              event={event}
              members={members}
              hostKey={hostKey}
              ended={ended}
            />
          }
        />
      ) : (
        <HostFrame
          main={
            <PrepareView
              eventId={eventId}
              link={link}
              event={event}
              members={members}
              ended={ended}
              onEnded={() => setEndedHere(true)}
            />
          }
        />
      )}
      {barShown && (
        <BottomBar event={event} members={members} hostKey={hostKey} />
      )}
      {phone && <ViewSwitch variant="tabs" />}
    </div>
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
      {!eventId && <EventSection link={link} defaultOpen />}
    </div>
  );
}
