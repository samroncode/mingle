import { useTranslation } from "react-i18next";

/** Placeholder for the guest page until the awards' voting is built. */
export function AwardsGuest() {
  const { t } = useTranslation();
  return (
    <section data-testid="awards-guest" className="space-y-2">
      <h2 className="text-2xl font-semibold">{t("modules.awards.name")}</h2>
    </section>
  );
}
