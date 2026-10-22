import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { EventCode } from "@/components/EventCode";
import { useGuestLookup } from "@/hooks/useGuestLookup";
import { GuestMessage } from "./guest/GuestMessage";

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
    <>
      <h1 className="text-2xl font-semibold">{t("views.summary.title")}</h1>
      <EventCode />
    </>
  );
}
