import { useTranslation } from "react-i18next";
import type { HotTakeSplit } from "@/api/hottakes";
import { cn } from "@/lib/utils";
import { splitView } from "./split";

interface SplitBarsProps {
  split: HotTakeSplit;
  /** Bigger type for the TV. */
  large?: boolean;
}

/**
 * The room's split on a revealed hot take: an Agree and a Disagree bar with
 * percentage and count, or a plain line when nobody answered or it is 50/50.
 */
export function SplitBars({ split, large }: SplitBarsProps) {
  const { t } = useTranslation();
  const view = splitView(split);
  if (view.kind === "none") {
    return (
      <p
        data-testid="hottakes-split"
        className={large ? "text-5xl" : "text-lg"}
      >
        {t("modules.hottakes.split.none")}
      </p>
    );
  }
  const rows = [
    {
      key: "agree",
      percent: view.agreePercent,
      count: split.agree,
      bar: "bg-primary",
    },
    {
      key: "disagree",
      percent: view.disagreePercent,
      count: split.disagree,
      bar: "bg-ink-muted",
    },
  ] as const;
  return (
    <div
      data-testid="hottakes-split"
      className={cn("space-y-3", large && "space-y-6")}
    >
      {rows.map((row) => (
        <div key={row.key} data-testid={`hottakes-split-${row.key}`}>
          <p className={cn("font-semibold", large ? "text-4xl" : "text-base")}>
            {t(`modules.hottakes.split.${row.key}`)}{" "}
            {t("modules.hottakes.split.share", {
              percent: row.percent,
              count: row.count,
            })}
          </p>
          <div
            className={cn(
              "mt-1 overflow-hidden rounded-full bg-surface-sunken",
              large ? "h-8" : "h-3",
            )}
          >
            <div
              className={cn("h-full", row.bar)}
              style={{ width: `${row.percent}%` }}
            />
          </div>
        </div>
      ))}
      {view.kind === "even" && (
        <p className={large ? "text-4xl" : "text-base"}>
          {t("modules.hottakes.split.even")}
        </p>
      )}
    </div>
  );
}
