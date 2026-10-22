import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { QuizQuestionView } from "@/api/quiz";
import { Card } from "@/components/ui/card";
import { optionLetters } from "../screen";

/** One question with its options, the right one marked for the host. */
export function QuestionCard({ question }: { question: QuizQuestionView }) {
  const { t } = useTranslation();
  return (
    <Card className="gap-2 p-3">
      <p className="font-medium">
        {question.position + 1}. {question.text}
      </p>
      <ul className="space-y-1 text-sm">
        {question.options.map((option, index) => {
          const right = index === question.correct;
          return (
            <li
              key={index}
              className={right ? "font-semibold text-primary" : ""}
            >
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
    </Card>
  );
}

/** The quiz's questions in order, with the right answer marked. */
export function QuestionList({ questions }: { questions: QuizQuestionView[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <h3 className="font-semibold">{t("modules.quiz.host.title")}</h3>
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("modules.quiz.host.empty")}
        </p>
      ) : (
        <ol className="space-y-2">
          {questions.map((question) => (
            <li key={question.id}>
              <QuestionCard question={question} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
