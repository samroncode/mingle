import { ErrorLine } from "@/components/ErrorLine";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getMyAwardVote, voteForGuest } from "@/api/awards";
import type { AwardCategoryView } from "@/api/awards";
import type { MemberRow } from "@/api/events";
import { voteCandidates } from "../candidates";
import { useAwardWinners, useMyAwardVotes } from "../useAwardResults";
import { WinnerText } from "../WinnerText";
import { VoteButtons } from "./VoteButtons";

interface GuestCategoryProps {
  eventId: string;
  userId: string;
  language: string;
  members: MemberRow[];
  category: AwardCategoryView;
  number: number;
  total: number;
  /** The reveal closes the voting. */
  revealed: boolean;
  /** Counts the awards reads, so the results are read again with them. */
  version: number;
}

/**
 * An open category on the phone: one button per other guest, A to Z, until
 * the reveal. The pick stays marked and can be changed. Keyed by the
 * category, so the pick follows the category and not the phase.
 */
export function GuestCategory({
  eventId,
  userId,
  language,
  members,
  category,
  number,
  total,
  revealed,
  version,
}: GuestCategoryProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const candidates = voteCandidates(members, userId, language);
  const winners = useAwardWinners(category.id, revealed, version);
  const myVotes = useMyAwardVotes(category.id, revealed, version);

  useEffect(() => {
    let stale = false;
    void getMyAwardVote(category.id, userId).then((result) => {
      // A tap made before this arrived wins over the stored vote.
      if (stale || !result.ok) return;
      setChosen((current) => current ?? result.value);
    });
    return () => {
      stale = true;
    };
  }, [category.id, userId]);

  async function choose(votedForId: string) {
    const before = chosen;
    setChosen(votedForId);
    setError(undefined);
    const result = await voteForGuest({
      eventId,
      categoryId: category.id,
      voterId: userId,
      votedForId,
    });
    if (result.ok) return;
    setChosen(before);
    setError(t(`modules.awards.guest.errors.${result.error}`));
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("modules.awards.counter", { number, total })}
      </p>
      <h2 className="text-xl font-semibold">{category.text}</h2>
      {!revealed &&
        (candidates.length === 0 ? (
          <p data-testid="awards-waiting" className="text-lg">
            {t("modules.awards.guest.waitingForGuests")}
          </p>
        ) : (
          <VoteButtons
            candidates={candidates}
            chosen={chosen}
            onChoose={(id) => void choose(id)}
          />
        ))}
      {revealed && winners.status === "ready" && (
        <p data-testid="awards-winner" className="text-3xl font-semibold">
          <WinnerText
            winners={winners.value}
            members={members}
            language={language}
          />
        </p>
      )}
      {revealed && myVotes.status === "ready" && myVotes.value !== null && (
        <p data-testid="awards-my-votes" className="text-lg">
          {t("modules.awards.guest.youGot", { count: myVotes.value })}
        </p>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}
