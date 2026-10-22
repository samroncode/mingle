import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { useQuizQuestions } from "@/hooks/useQuizQuestions";
import type { ModuleViewProps } from "../../types";

const optionLetters = ["A", "B", "C", "D"] as const;

/** The quiz's questions in order, with the right answer marked. */
export function QuizHost({ event }: ModuleViewProps) {
  const { t } = useTranslation();
  const state = useQuizQuestions(event.id);

  return (
    <section
      data-testid="quiz-host"
      aria-labelledby="quiz-host-title"
      className="space-y-2"
    >
      <h2 id="quiz-host-title" className="text-lg font-semibold">
        {t("modules.quiz.host.title")}
      </h2>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {t("modules.quiz.host.loadFailed")}
        </p>
      )}
      {state.status === "ready" && state.questions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("modules.quiz.host.empty")}
        </p>
      )}
      {state.status === "ready" && (
        <ol className="space-y-2">
          {state.questions.map((question) => (
            <li key={question.id}>
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
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
