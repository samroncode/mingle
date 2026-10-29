import { useTranslation } from "react-i18next";
import type { ModuleGuestViewProps } from "../../types";
import { hotTakesScreen } from "../screen";
import { useHotTakesRun } from "../useHotTakesRun";
import { GuestTake } from "./GuestTake";

/** The guest page while the hot takes run. */
export function HotTakesGuest({ event, userId }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const run = useHotTakesRun(event);
  const screen = hotTakesScreen(event, run.progress, run.takes);

  return (
    <section
      data-testid="hottakes-guest"
      data-screen={screen.kind}
      className="space-y-4"
    >
      {screen.kind === "loading" && (
        <p className="text-2xl font-semibold">{t("modules.hottakes.name")}</p>
      )}
      {screen.kind === "idle" && (
        <p className="text-2xl font-semibold">
          {t("modules.hottakes.guest.coming")}
        </p>
      )}
      {screen.kind === "take" && (
        <GuestTake
          key={screen.take.id}
          eventId={event.id}
          userId={userId}
          take={screen.take}
          number={screen.number}
          total={screen.total}
          revealed={screen.revealed}
        />
      )}
      {screen.kind === "summary" && (
        <h2 className="text-2xl font-semibold">
          {t("modules.hottakes.summaryTitle")}
        </h2>
      )}
    </section>
  );
}
