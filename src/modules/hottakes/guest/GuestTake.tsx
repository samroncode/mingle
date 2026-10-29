import { ErrorLine } from "@/components/ErrorLine";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { answerHotTake, getMyHotTakeAnswer } from "@/api/hottakes";
import type { HotTakeView } from "@/api/hottakes";
import { AnswerButtons } from "./AnswerButtons";

interface GuestTakeProps {
  eventId: string;
  userId: string;
  take: HotTakeView;
  number: number;
  total: number;
  /** The reveal closes the answers. */
  revealed: boolean;
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
  revealed,
}: GuestTakeProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stale = false;
    void getMyHotTakeAnswer(take.id, userId).then((result) => {
      // A tap made before this arrived wins over the stored answer.
      if (stale || !result.ok) return;
      setChosen((current) => current ?? result.value);
    });
    return () => {
      stale = true;
    };
  }, [take.id, userId]);

  async function choose(agree: boolean) {
    const before = chosen;
    setChosen(agree);
    setError(undefined);
    const result = await answerHotTake({
      eventId,
      hotTakeId: take.id,
      guestId: userId,
      agree,
    });
    if (result.ok) return;
    setChosen(before);
    setError(t(`modules.hottakes.guest.errors.${result.error}`));
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("modules.hottakes.counter", { number, total })}
      </p>
      <h2 className="text-2xl font-semibold">{take.text}</h2>
      {!revealed && (
        <AnswerButtons chosen={chosen} onChoose={(a) => void choose(a)} />
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}
