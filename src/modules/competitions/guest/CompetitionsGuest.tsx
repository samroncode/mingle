import { useTranslation } from "react-i18next";
import type { ModuleGuestViewProps } from "../../types";
import { GuestMatches } from "./GuestMatches";

/** The guest page while Competitions is the running activity: report a match. */
export function CompetitionsGuest(props: ModuleGuestViewProps) {
  const { t } = useTranslation();
  return (
    <section data-testid="competitions-guest" className="space-y-4">
      <p className="font-display text-3xl font-extrabold">
        {t("modules.competitions.name")}
      </p>
      <GuestMatches {...props} />
    </section>
  );
}
