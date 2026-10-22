import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/hooks/useQuizRun";
import type { ModuleGuestViewProps } from "../../types";
import { QuizOptions } from "../QuizOptions";
import { optionLetters, quizScreen } from "../screen";

/** The guest page while the quiz runs. Answering comes in a later ticket. */
export function QuizGuest({ event }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const run = useQuizRun(event);
  const screen = quizScreen(event, run.progress, run.questions);

  return (
    <section
      data-testid="quiz-guest"
      data-screen={screen.kind}
      className="space-y-4"
    >
      {screen.kind === "loading" && (
        <p className="text-2xl font-semibold">{t("modules.quiz.name")}</p>
      )}
      {screen.kind === "idle" && (
        <p className="text-2xl font-semibold">
          {t("modules.quiz.guest.coming")}
        </p>
      )}
      {(screen.kind === "open" || screen.kind === "revealed") && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("modules.quiz.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <h2 className="text-xl font-semibold">{screen.question.text}</h2>
          <QuizOptions
            options={screen.question.options}
            correct={screen.kind === "revealed" ? screen.correct : null}
            itemClassName="text-lg"
          />
          {screen.kind === "revealed" && (
            <p className="text-lg font-semibold">
              {t("modules.quiz.guest.answerWas", {
                letter: optionLetters[screen.correct],
              })}
            </p>
          )}
        </>
      )}
      {screen.kind === "results" && (
        <p className="text-2xl font-semibold">{t("modules.quiz.results")}</p>
      )}
    </section>
  );
}
