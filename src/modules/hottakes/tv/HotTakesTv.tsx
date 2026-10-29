import { useTranslation } from "react-i18next";

/** Placeholder for the left side of the TV until the hot takes' run is built. */
export function HotTakesTv() {
  const { t } = useTranslation();
  return (
    <section
      data-testid="hottakes-tv"
      className="flex min-h-[70svh] flex-col justify-center"
    >
      <p className="text-5xl font-semibold">{t("modules.hottakes.name")}</p>
    </section>
  );
}
