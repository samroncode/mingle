import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { useAwardsRun } from "./useAwardsRun";

/** "award 3 of 8" for the control panel's top bar, while on a category. */
export function useAwardsProgressText(event: EventRow): string | undefined {
  const { t } = useTranslation();
  const { progress } = useAwardsRun(event);
  if (!progress || event.current_step >= progress.total) return undefined;
  return t("modules.awards.progress", {
    number: event.current_step + 1,
    total: progress.total,
  });
}
