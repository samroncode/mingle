import { useTranslation } from "react-i18next";

/** Placeholder for the Lucky wheel on a phone; a later ticket shows the result. */
export function WheelGuest() {
  const { t } = useTranslation();
  return (
    <section data-testid="wheel-guest" className="space-y-4">
      <p className="font-display text-3xl font-extrabold">
        {t("modules.wheel.name")}
      </p>
    </section>
  );
}
