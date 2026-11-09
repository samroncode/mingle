import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { useCompetitions } from "./useCompetitions";

/** "2 competitions" for the control panel header. */
export function useCompetitionsSummary(event: EventRow): string | undefined {
  const { t } = useTranslation();
  const { competitions } = useCompetitions(event.id);
  if (competitions.status !== "ready") return undefined;
  return t("modules.competitions.items", {
    count: competitions.value.length,
  });
}
