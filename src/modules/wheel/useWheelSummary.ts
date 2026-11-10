import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { useWheelEntries } from "./useWheelEntries";
import { useWheelSpins } from "./useWheelSpins";

/** "5 on the wheel, 3 spins" for the activities row and the panel header. */
export function useWheelSummary(event: EventRow): string | undefined {
  const { t } = useTranslation();
  const { entries } = useWheelEntries(event.id);
  const spins = useWheelSpins(event.id);
  if (entries.status !== "ready") return undefined;
  const onWheel = entries.value.filter((e) => e.state === "on").length;
  const spun = spins.status === "ready" ? spins.value.length : 0;
  return t("modules.wheel.summary", {
    onWheel: t("modules.wheel.onWheel", { count: onWheel }),
    spins: t("modules.wheel.spins", { count: spun }),
  });
}
