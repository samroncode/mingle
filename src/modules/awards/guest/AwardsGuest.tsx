import { useTranslation } from "react-i18next";
import type { ModuleGuestViewProps } from "../../types";
import { awardsScreen } from "../screen";
import { useAwardsRun } from "../useAwardsRun";
import { GuestCategory } from "./GuestCategory";
import { GuestWinners } from "./GuestWinners";

/** The guest page while the awards run. */
export function AwardsGuest({ event, members, userId }: ModuleGuestViewProps) {
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
        <p className="font-display text-3xl font-extrabold">
          {t("modules.awards.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <p className="font-display text-3xl font-extrabold">
          {t("modules.awards.guest.coming")}
        </p>
      )}
      {screen.kind === "category" && (
        <GuestCategory
          key={screen.category.id}
          eventId={event.id}
          userId={userId}
          language={event.language}
          members={members}
          category={screen.category}
          number={screen.number}
          total={screen.total}
          revealed={screen.revealed}
          version={run.version}
        />
      )}
      {screen.kind === "winners" && (
        <GuestWinners
          eventId={event.id}
          userId={userId}
          language={event.language}
          members={members}
          version={run.version}
        />
      )}
    </section>
  );
}
