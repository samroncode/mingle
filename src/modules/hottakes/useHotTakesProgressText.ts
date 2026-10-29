import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { useHotTakesRun } from "./useHotTakesRun";

/** "hot take 3 of 8" for the control panel's top bar, while on a hot take. */
export function useHotTakesProgressText(event: EventRow): string | undefined {
  const { t } = useTranslation();
  const { progress } = useHotTakesRun(event);
  if (!progress || event.current_step >= progress.total) return undefined;
  return t("modules.hottakes.progress", {
    number: event.current_step + 1,
    total: progress.total,
  });
}
