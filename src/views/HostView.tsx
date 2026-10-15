import { useTranslation } from "react-i18next";
import { EventCode } from "@/components/EventCode";

export function HostView() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("views.host.title")}</h1>
      <EventCode />
    </>
  );
}
