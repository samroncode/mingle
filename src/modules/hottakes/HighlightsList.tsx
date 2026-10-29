import { useTranslation } from "react-i18next";
import type { HotTakeHighlights } from "@/api/hottakes";
import { cn } from "@/lib/utils";
import { SplitBars } from "./SplitBars";

interface HighlightsListProps {
  highlights: HotTakeHighlights;
  large?: boolean;
}

/** The summary's two picks, each with its split. Nothing if none had answers. */
export function HighlightsList({ highlights, large }: HighlightsListProps) {
  const { t } = useTranslation();
  const picks = [
    { key: "divisive", take: highlights.divisive },
    { key: "agreed", take: highlights.agreed },
  ] as const;
  const shown = picks.filter((pick) => pick.take);
  if (shown.length === 0) {
    return (
      <p data-testid="hottakes-highlights" className={large ? "text-4xl" : ""}>
        {t("modules.hottakes.summary.none")}
      </p>
    );
  }
  return (
    <div
      data-testid="hottakes-highlights"
      className={cn("space-y-6", large && "space-y-10")}
    >
      {shown.map(({ key, take }) =>
        take ? (
          <section key={key} data-testid={`hottakes-highlight-${key}`}>
            <h3
              className={cn(
                "text-ink-muted",
                large ? "text-3xl" : "text-sm font-medium",
              )}
            >
              {t(`modules.hottakes.summary.${key}`)}
            </h3>
            <p
              className={cn(
                "my-2 font-semibold",
                large ? "text-5xl" : "text-xl",
              )}
            >
              {take.text}
            </p>
            <SplitBars split={take} large={large} />
          </section>
        ) : null,
      )}
    </div>
  );
}
