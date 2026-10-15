import { useTranslation } from "react-i18next";
import { EventCode } from "@/components/EventCode";

export function TvView() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="text-6xl font-semibold">{t("views.tv.title")}</h1>
      <EventCode />
    </>
  );
}
