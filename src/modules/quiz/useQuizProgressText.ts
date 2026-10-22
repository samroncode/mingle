import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { useQuizRun } from "@/hooks/useQuizRun";

/** "question 3 of 10" for the control panel's top bar, while on a question. */
export function useQuizProgressText(event: EventRow): string | undefined {
  const { t } = useTranslation();
  const { progress } = useQuizRun(event);
  if (!progress || event.current_step >= progress.total) return undefined;
  return t("modules.quiz.progress", {
    number: event.current_step + 1,
    total: progress.total,
  });
}
