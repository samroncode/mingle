import { useTranslation } from "react-i18next";
import { EventCode } from "@/components/EventCode";

export function GuestView() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("views.guest.title")}</h1>
      <EventCode />
    </>
  );
}
