import { useTranslation } from "react-i18next";
import type { ModuleGuestViewProps } from "../../types";
import { awardsScreen } from "../screen";
import { useAwardsRun } from "../useAwardsRun";

/** The guest page while the awards run. */
export function AwardsGuest({ event }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  const screen = awardsScreen(event, run.progress, run.categories);

  return (
    <section
      data-testid="awards-guest"
      data-screen={screen.kind}
      className="space-y-4"
    >
      {screen.kind === "loading" && (
        <p className="text-2xl font-semibold">{t("modules.awards.name")}</p>
      )}
      {screen.kind === "idle" && (
        <p className="text-2xl font-semibold">
          {t("modules.awards.guest.coming")}
        </p>
      )}
      {screen.kind === "category" && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("modules.awards.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <h2 className="text-2xl font-semibold">{screen.category.text}</h2>
        </>
      )}
      {screen.kind === "winners" && (
        <h2 className="text-2xl font-semibold">
          {t("modules.awards.winnersTitle")}
        </h2>
      )}
    </section>
  );
}
