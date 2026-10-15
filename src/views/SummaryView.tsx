import { useTranslation } from "react-i18next";
import { EventCode } from "@/components/EventCode";

export function SummaryView() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-2xl font-semibold">{t("views.summary.title")}</h1>
      <EventCode />
    </>
  );
}
