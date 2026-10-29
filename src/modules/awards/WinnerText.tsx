import { useTranslation } from "react-i18next";
import type { AwardWinner } from "@/api/awards";
import type { MemberRow } from "@/api/events";
import { joinNames, winnerLine } from "./winners";

interface WinnerTextProps {
  winners: AwardWinner[];
  members: MemberRow[];
  language: string;
}

/**
 * "Anna, 4 votes", a tie as "Anna and Bertil, 4 votes each", or "No votes
 * this time". Nobody else is listed.
 */
export function WinnerText({ winners, members, language }: WinnerTextProps) {
  const { t } = useTranslation();
  const line = winnerLine(winners, members, language);
  if (line.kind === "none") return <>{t("modules.awards.winner.none")}</>;
  return (
    <>
      {t(
        line.names.length > 1
          ? "modules.awards.winner.tie"
          : "modules.awards.winner.line",
        {
          names: joinNames(line.names, language),
          count: line.votes,
        },
      )}
    </>
  );
}
