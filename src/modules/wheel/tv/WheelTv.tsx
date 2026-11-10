import { useTranslation } from "react-i18next";
import { TvStage } from "../../TvStage";

/** Placeholder for the Lucky wheel on the TV; a later ticket draws the wheel. */
export function WheelTv() {
  const { t } = useTranslation();
  return (
    <TvStage data-testid="wheel-tv" moment={false} momentKey="wheel">
      <h2 className="font-display text-6xl font-extrabold">
        {t("modules.wheel.name")}
      </h2>
    </TvStage>
  );
}
