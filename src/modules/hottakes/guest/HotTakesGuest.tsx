import { useTranslation } from "react-i18next";
import type { ModuleGuestViewProps } from "../../types";
import { hotTakesScreen } from "../screen";
import { useHotTakesRun } from "../useHotTakesRun";
import { GuestSummary } from "./GuestSummary";
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
        <p className="font-display text-3xl font-extrabold">
          {t("modules.hottakes.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <p className="font-display text-3xl font-extrabold">
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
          version={run.version}
        />
      )}
      {screen.kind === "summary" && (
        <GuestSummary eventId={event.id} version={run.version} />
      )}
    </section>
  );
}
