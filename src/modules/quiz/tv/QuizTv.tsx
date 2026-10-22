import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/hooks/useQuizRun";
import type { ModuleViewProps } from "../../types";
import { QuizOptions } from "../QuizOptions";
import { quizScreen } from "../screen";

/** The left side of the TV while the quiz runs. */
export function QuizTv({ event }: ModuleViewProps) {
  const { t } = useTranslation();
  const run = useQuizRun(event);
  const screen = quizScreen(event, run.progress, run.questions);

  return (
    <section
      data-testid="quiz-tv"
      data-screen={screen.kind}
      className="flex min-h-[70svh] flex-col justify-center gap-8"
    >
      {screen.kind === "loading" && (
        <p className="text-5xl font-semibold">{t("modules.quiz.name")}</p>
      )}
      {screen.kind === "idle" && (
        <>
          <p className="text-4xl text-muted-foreground">
            {t("modules.quiz.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <p className="text-7xl font-semibold">{t("modules.quiz.tv.ready")}</p>
        </>
      )}
      {(screen.kind === "open" || screen.kind === "revealed") && (
        <>
          <p className="text-3xl text-muted-foreground">
            {t("modules.quiz.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </p>
          <h2 className="text-6xl font-semibold">{screen.question.text}</h2>
          <QuizOptions
            options={screen.question.options}
            correct={screen.kind === "revealed" ? screen.correct : null}
            itemClassName="text-4xl py-6"
          />
        </>
      )}
      {screen.kind === "results" && (
        <p className="text-6xl font-semibold">{t("modules.quiz.results")}</p>
      )}
    </section>
  );
}
