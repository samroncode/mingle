import { useTranslation } from "react-i18next";

export function LandingView() {
  const { t } = useTranslation();
  return <h1 className="text-3xl font-semibold">{t("app.name")}</h1>;
}
