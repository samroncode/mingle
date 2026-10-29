import { useTranslation } from "react-i18next";
import { HighlightsList } from "../HighlightsList";
import {
  useHotTakeHighlights,
  useMyHotTakeMajority,
} from "../useHotTakeResults";

interface GuestSummaryProps {
  eventId: string;
  version: number;
}

/** The summary step on the phone: the two highlights, and the guest's own count. */
export function GuestSummary({ eventId, version }: GuestSummaryProps) {
  const { t } = useTranslation();
  const highlights = useHotTakeHighlights(eventId, true, version);
  const majority = useMyHotTakeMajority(eventId, true, version);
  const mine =
    majority.status === "ready" && majority.value?.answered
      ? majority.value
      : undefined;

  return (
    <>
      <h2 className="text-2xl font-semibold">
        {t("modules.hottakes.summaryTitle")}
      </h2>
      {highlights.status === "ready" && (
        <HighlightsList highlights={highlights.value} />
      )}
      {mine && (
        <p data-testid="hottakes-my-majority" className="text-lg">
          {t("modules.hottakes.summary.sided", {
            sided: mine.sided,
            count: mine.answered,
          })}
        </p>
      )}
    </>
  );
}
