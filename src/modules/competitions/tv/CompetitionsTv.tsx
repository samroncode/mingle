import { useTranslation } from "react-i18next";

/** The TV while Competitions is in the spotlight. Tables come in a later ticket. */
export function CompetitionsTv() {
  const { t } = useTranslation();
  return (
    <section data-testid="competitions-tv">
      <p className="font-display text-5xl font-extrabold">
        {t("modules.competitions.name")}
      </p>
    </section>
  );
}
