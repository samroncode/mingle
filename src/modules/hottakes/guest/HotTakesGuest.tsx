import { useTranslation } from "react-i18next";

/** Placeholder for the guest page until the hot takes' answering is built. */
export function HotTakesGuest() {
  const { t } = useTranslation();
  return (
    <section data-testid="hottakes-guest" className="space-y-2">
      <h2 className="text-2xl font-semibold">{t("modules.hottakes.name")}</h2>
    </section>
  );
}
