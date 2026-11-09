import { ErrorLine } from "@/components/ErrorLine";
import { useLoad } from "@/hooks/useLoad";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { answerHotTake, getMyHotTakeAnswer } from "@/api/hottakes";
import type { HotTakeView } from "@/api/hottakes";
import { ItemProgress } from "@/components/ItemProgress";
import { AnswerNotes } from "../../AnswerNotes";
import { answeredCount } from "../../guestCounts";
import { guestStanding } from "../split";
import { SplitBars } from "../SplitBars";
import { useHotTakeResult } from "../useHotTakeResults";
import { AnswerButtons } from "./AnswerButtons";

interface GuestTakeProps {
  eventId: string;
  userId: string;
  take: HotTakeView;
  number: number;
  total: number;
  /** How many guests are in the event. */
  guests: number;
  /** The reveal closes the answers. */
  revealed: boolean;
  /** Changes whenever the hot takes are read again. */
  version: number;
}

/**
 * An open hot take on the phone: the statement and Agree / Disagree until the
 * reveal. The pick stays marked and can be changed. Keyed by the hot take, so
 * the pick follows the hot take and not the phase.
 */
export function GuestTake({
  eventId,
  userId,
  take,
  number,
  total,
  guests,
  revealed,
  version,
}: GuestTakeProps) {
  const { t } = useTranslation();
  // A tap made before the stored answer is read wins over it.
  const stored = useLoad(take.id, () => getMyHotTakeAnswer(take.id, userId));
  const [tapped, setTapped] = useState<boolean | null>();
  const [error, setError] = useState<string>();
  const chosen = tapped ?? (stored.status === "ready" ? stored.value : null);

  const result = useHotTakeResult(take.id, revealed, version);
  const standing =
    result.status === "ready" && result.value
      ? guestStanding(chosen, result.value)
      : null;

  async function choose(agree: boolean) {
    const before = chosen;
    setTapped(agree);
    setError(undefined);
    const result = await answerHotTake({
      eventId,
      hotTakeId: take.id,
      guestId: userId,
      agree,
    });
    if (result.ok) return;
    setTapped(before);
    setError(t(`modules.hottakes.guest.errors.${result.error}`));
  }

  return (
    <>
      <ItemProgress
        activity={t("modules.hottakes.name")}
        position={t("modules.hottakes.counter", { number, total })}
        number={number}
        total={total}
      />
      <h2 className="font-display text-3xl leading-tight font-extrabold">
        {take.text}
      </h2>
      {!revealed && (
        <>
          <AnswerButtons chosen={chosen} onChoose={(a) => void choose(a)} />
          <AnswerNotes
            answered={answeredCount(take.answerCount, chosen !== null)}
            total={guests}
          />
        </>
      )}
      {revealed && result.status === "ready" && result.value && (
        <SplitBars split={result.value} />
      )}
      {standing && (
        <p
          data-testid="hottakes-standing"
          className="fun-pop font-display text-2xl font-extrabold text-champagne-text"
        >
          {t(`modules.hottakes.split.${standing}`)}
        </p>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}
