import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EventCode } from "@/components/EventCode";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { useEventLanguage } from "@/hooks/useEventLanguage";
import { useEventState } from "@/hooks/useEventState";
import { useGuestLookup } from "@/hooks/useGuestLookup";
import { CompetitionResults } from "@/modules/competitions/CompetitionResults";
import { GuestMessage } from "../guest/GuestMessage";

export function SummaryView() {
  const { code = "" } = useParams();
  const { lookup, userId } = useGuestLookup(code);

  // Only members can read an event, so an unknown, expired or deleted event
  // answers like one this device never joined.
  if (typeof lookup === "object" && !lookup.isMember) {
    return <GuestMessage kind="not_found" />;
  }
  return (
    <SummaryPage
      eventId={typeof lookup === "object" ? lookup.eventId : undefined}
      userId={userId}
    />
  );
}

function SummaryPage({
  eventId,
  userId,
}: {
  eventId: string | undefined;
  userId: string;
}) {
  const { t } = useTranslation();
  return (
    <Card className="gap-4 p-6">
      <Sticker color="sage" lean="left" className="self-start">
        {t("views.summary.sticker")}
      </Sticker>
      <h1 className="font-display text-5xl leading-none font-extrabold">
        {t("views.summary.title")}
      </h1>
      <EventCode />
      {eventId && <SummaryResults eventId={eventId} userId={userId} />}
    </Card>
  );
}

/** What each activity left behind; an activity with nothing to show is absent. */
function SummaryResults({
  eventId,
  userId,
}: {
  eventId: string;
  userId: string;
}) {
  const { t } = useTranslation();
  const state = useEventState(eventId);
  useEventLanguage(state.event?.language);
  if (state.status === "error" && !state.event) {
    return (
      <p role="alert" className="text-sm font-bold text-danger-text">
        {t("guest.error.body")}
      </p>
    );
  }
  if (!state.event) return null;
  return (
    <CompetitionResults
      event={state.event}
      members={state.members}
      userId={userId}
    />
  );
}
