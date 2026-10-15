import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

/** Shows the event code from the current route, e.g. `/tv/:code`. */
export function EventCode() {
  const { t } = useTranslation();
  const { code } = useParams();
  return <p className="text-muted-foreground">{t("common.code", { code })}</p>;
}
