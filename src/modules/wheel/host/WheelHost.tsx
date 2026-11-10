import { useTranslation } from "react-i18next";

/** Placeholder for the Lucky wheel's control panel section; a later ticket fills it. */
export function WheelHost() {
  const { t } = useTranslation();
  return (
    <p data-testid="wheel-host" className="text-sm text-ink-muted">
      {t("modules.wheel.host.soon")}
    </p>
  );
}
