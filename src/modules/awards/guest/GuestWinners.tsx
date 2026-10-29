import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import { useAwardResults, useAwardsWon } from "../useAwardResults";
import { WinnersList } from "../WinnersList";

interface GuestWinnersProps {
  eventId: string;
  userId: string;
  language: string;
  members: MemberRow[];
  version: number;
}

/** The winners step on the phone: every winner, and how many the guest won. */
export function GuestWinners({
  eventId,
  userId,
  language,
  members,
  version,
}: GuestWinnersProps) {
  const { t } = useTranslation();
  const results = useAwardResults(eventId, true, version);
  const won = useAwardsWon(eventId, true, version);
  const mine =
    won.status === "ready"
      ? won.value.find((row) => row.userId === userId)
      : undefined;

  return (
    <>
      <h2 className="font-display text-3xl font-extrabold">
        {t("modules.awards.winnersTitle")}
      </h2>
      {mine && (
        <p data-testid="awards-my-awards" className="text-lg font-medium">
          {t("modules.awards.guest.youWon", { count: mine.awards })}
        </p>
      )}
      {results.status === "ready" && (
        <WinnersList
          results={results.value}
          members={members}
          language={language}
        />
      )}
    </>
  );
}
