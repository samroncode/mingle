import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { QuizQuestionView } from "@/api/quiz";
import { optionLetters } from "../screen";

/** The running question as the largest text on the screen, with its options. */
export function LiveQuestion({ question }: { question: QuizQuestionView }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <h2 className="font-display text-2xl leading-tight font-bold lg:text-4xl">
        {question.text}
      </h2>
      <ul className="space-y-1 text-base lg:text-lg">
        {question.options.map((option, index) => {
          const right = index === question.correct;
          return (
            <li key={index} className={right ? "font-bold" : undefined}>
              {optionLetters[index]}. {option}
              {right && (
                <>
                  <Check aria-hidden className="ml-1 inline size-4" />
                  <span className="sr-only">
                    {t("modules.quiz.host.rightAnswer")}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
