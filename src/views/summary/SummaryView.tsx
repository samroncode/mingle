import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EventCode } from "@/components/EventCode";
import { Card } from "@/components/ui/card";
import { Sticker } from "@/components/ui/sticker";
import { useGuestLookup } from "@/hooks/useGuestLookup";
import { GuestMessage } from "../guest/GuestMessage";

export function SummaryView() {
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const { lookup } = useGuestLookup(code);

  // Only members can read an event, so an unknown, expired or deleted event
  // answers like one this device never joined.
  if (typeof lookup === "object" && !lookup.isMember) {
    return <GuestMessage kind="not_found" />;
  }
  return (
    <Card className="gap-4 p-6">
      <Sticker color="sage" lean="left" className="self-start">
        {t("views.summary.sticker")}
      </Sticker>
      <h1 className="font-display text-5xl leading-none font-extrabold">
        {t("views.summary.title")}
      </h1>
      <EventCode />
    </Card>
  );
}
