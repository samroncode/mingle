import { useTranslation } from "react-i18next";

/** Placeholder for the left side of the TV until the awards' run is built. */
export function AwardsTv() {
  const { t } = useTranslation();
  return (
    <section
      data-testid="awards-tv"
      className="flex min-h-[70svh] flex-col justify-center"
    >
      <p className="text-5xl font-semibold">{t("modules.awards.name")}</p>
    </section>
  );
}
