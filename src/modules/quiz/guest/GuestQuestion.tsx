import { ErrorLine } from "@/components/ErrorLine";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { answerQuizQuestion, getMyQuizAnswer } from "@/api/quiz";
import type { QuizQuestionView } from "@/api/quiz";
import { QuizOptions } from "../QuizOptions";
import { Counter } from "../../Counter";
import { ResultBadge } from "../../ResultBadge";
import { optionLetters } from "../screen";
import { AnswerButtons } from "./AnswerButtons";

interface GuestQuestionProps {
  eventId: string;
  userId: string;
  question: QuizQuestionView;
  number: number;
  total: number;
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
  correct,
  score,
}: GuestQuestionProps) {
  const { t } = useTranslation();
  // undefined until the stored answer is read, so a reload right after the
  // reveal never flashes "wrong" for a guest who was right.
  const [chosen, setChosen] = useState<number | null | undefined>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let stale = false;
    void getMyQuizAnswer(question.id, userId).then((result) => {
      // A tap made before this arrived wins over the stored answer.
      if (stale) return;
      const stored = result.ok ? result.value : null;
      setChosen((current) => current ?? stored);
    });
    return () => {
      stale = true;
    };
  }, [question.id, userId]);

  async function choose(index: number) {
    const before = chosen;
    setChosen(index);
    setError(undefined);
    const result = await answerQuizQuestion({
      eventId,
      questionId: question.id,
      userId,
      chosen: index,
    });
    if (result.ok) return;
    setChosen(before);
    setError(t(`modules.quiz.guest.errors.${result.error}`));
  }

  return (
    <>
      <Counter>{t("modules.quiz.counter", { number, total })}</Counter>
      <h2 className="font-display text-3xl leading-tight font-extrabold">
        {question.text}
      </h2>
      {correct === null ? (
        <AnswerButtons
          options={question.options}
          chosen={chosen ?? null}
          onChoose={(index) => void choose(index)}
        />
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
