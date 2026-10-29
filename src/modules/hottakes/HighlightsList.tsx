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
      <p
        data-testid="hottakes-highlights"
        className={large ? "font-display text-4xl font-bold" : ""}
      >
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
                "font-bold tracking-wide uppercase",
                large
                  ? "text-3xl text-champagne-text"
                  : "text-sm text-champagne-text",
              )}
            >
              {t(`modules.hottakes.summary.${key}`)}
            </h3>
            <p
              className={cn(
                "my-2 font-display font-extrabold",
                large ? "text-5xl" : "text-2xl",
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
