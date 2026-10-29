import { useTranslation } from "react-i18next";
import type { ModuleViewProps } from "../../types";
import { awardsScreen } from "../screen";
import { useAwardsRun } from "../useAwardsRun";

/** The left side of the TV while the awards run. */
export function AwardsTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const run = useAwardsRun(event);
  const screen = awardsScreen(event, run.progress, run.categories);
  const guests = members.filter((m) => m.role === "guest").length;

  return (
    <section
      data-testid="awards-tv"
      data-screen={screen.kind}
      className="flex min-h-[70svh] flex-col justify-center gap-8"
    >
      {screen.kind === "loading" && (
        <p className="text-5xl font-semibold">{t("modules.awards.name")}</p>
      )}
      {screen.kind === "idle" && (
        <>
          <p className="text-4xl text-muted-foreground">
            {t("modules.awards.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <p className="text-7xl font-semibold">
            {t("modules.awards.tv.ready")}
          </p>
        </>
      )}
      {screen.kind === "category" && (
        <>
          <p className="text-3xl text-muted-foreground">
            {t("modules.awards.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <h2 className="text-6xl font-semibold">{screen.category.text}</h2>
          {!screen.revealed && (
            <p data-testid="awards-voted" className="text-4xl">
              {t("modules.awards.voted", {
                count: screen.category.voteCount,
                total: guests,
              })}
            </p>
          )}
        </>
      )}
      {screen.kind === "winners" && (
        <h2 className="text-6xl font-semibold">
          {t("modules.awards.winnersTitle")}
        </h2>
      )}
    </section>
  );
}
