import { useTranslation } from "react-i18next";

export function CreateView() {
  const { t } = useTranslation();
  return <h1 className="text-2xl font-semibold">{t("views.create.title")}</h1>;
}
