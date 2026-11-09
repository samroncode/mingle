import { ErrorLine } from "@/components/ErrorLine";
import { useLoad } from "@/hooks/useLoad";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { answerQuizQuestion, getMyQuizAnswer } from "@/api/quiz";
import type { QuizQuestionView } from "@/api/quiz";
import { QuizOptions } from "../QuizOptions";
import { ItemProgress } from "@/components/ItemProgress";
import { AnswerNotes } from "../../AnswerNotes";
import { answeredCount } from "../../guestCounts";
import { ResultBadge } from "../../ResultBadge";
import { optionLetters } from "../screen";
import { AnswerButtons } from "./AnswerButtons";

interface GuestQuestionProps {
  eventId: string;
  userId: string;
  question: QuizQuestionView;
  number: number;
  total: number;
  /** How many guests are in the event. */
  guests: number;
  /** The right option once revealed; null while the question is open. */
  correct: number | null;
  /** The guest score so far once revealed; undefined until it is read. */
  score?: number;
}

/**
 * An open or revealed question on the phone: buttons to answer (and change
 * the answer) until the reveal, then whether the guest was right. Keyed by the
 * question, so the chosen option follows the question and not the phase.
 */
export function GuestQuestion({
  eventId,
  userId,
  question,
  number,
  total,
  guests,
  correct,
  score,
}: GuestQuestionProps) {
  const { t } = useTranslation();
  // undefined until the stored answer is read, so a reload right after the
  // reveal never flashes "wrong" for a guest who was right. A tap made before
  // the read finishes wins over the stored answer.
  const stored = useLoad(question.id, () =>
    getMyQuizAnswer(question.id, userId),
  );
  const [tapped, setTapped] = useState<number | null>();
  const [error, setError] = useState<string>();
  const chosen =
    tapped ??
    (stored.status === "loading"
      ? undefined
      : stored.status === "ready"
        ? stored.value
        : null);

  async function choose(index: number) {
    const before = chosen;
    setTapped(index);
    setError(undefined);
    const result = await answerQuizQuestion({
      eventId,
      questionId: question.id,
      userId,
      chosen: index,
    });
    if (result.ok) return;
    setTapped(before);
    setError(t(`modules.quiz.guest.errors.${result.error}`));
  }

  return (
    <>
      <ItemProgress
        activity={t("modules.quiz.name")}
        position={t("modules.quiz.counter", { number, total })}
        number={number}
        total={total}
      />
      <h2 className="font-display text-3xl leading-tight font-extrabold">
        {question.text}
      </h2>
      {correct === null ? (
        <>
          <AnswerButtons
            options={question.options}
            chosen={chosen ?? null}
            onChoose={(index) => void choose(index)}
          />
          <AnswerNotes
            answered={answeredCount(
              question.answerCount,
              (chosen ?? null) !== null,
            )}
            total={guests}
          />
        </>
      ) : (
        <>
          <QuizOptions options={question.options} correct={correct} />
          {chosen !== undefined && (
            <ResultBadge testId="quiz-result" good={chosen === correct}>
              {chosen === correct
                ? t("modules.quiz.guest.right")
                : t("modules.quiz.guest.answerWas", {
                    letter: optionLetters[correct],
                  })}
            </ResultBadge>
          )}
          {score !== undefined && (
            <p data-testid="quiz-score" className="text-lg text-ink-muted">
              {t("modules.quiz.guest.scoreSoFar", { count: score })}
            </p>
          )}
        </>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </>
  );
}
