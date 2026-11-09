import { useTranslation } from "react-i18next";

/** The guest page for Competitions. Reporting matches comes in a later ticket. */
export function CompetitionsGuest() {
  const { t } = useTranslation();
  return (
    <section data-testid="competitions-guest">
      <p className="font-display text-3xl font-extrabold">
        {t("modules.competitions.name")}
      </p>
    </section>
  );
}
