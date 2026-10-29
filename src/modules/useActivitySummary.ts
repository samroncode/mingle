import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import type { ModuleId } from "./registry";

/**
 * The one-line summary of an activity for its panel header, such as
 * "8 questions, not started". Nothing until its progress has loaded.
 */
export function useActivitySummary(
  id: ModuleId,
  event: EventRow,
  progress: { total: number; done: number } | null,
): string | undefined {
  const { t } = useTranslation();
  if (!progress) return undefined;
  const { total, done } = progress;
  const state =
    event.current_module === id
      ? "running"
      : total > 0 && done >= total
        ? "played"
        : done > 0
          ? "partlyPlayed"
          : "notStarted";
  return t("hostPanel.summary.activity", {
    items: t(`modules.${id}.items`, { count: total }),
    state: t(`hostPanel.summary.state.${state}`, { done }),
  });
}
