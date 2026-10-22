import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/modules/quiz/useQuizRun";
import type { ModuleHostProps } from "../../types";
import { QuestionList } from "./QuestionList";
import { QuizControls } from "./QuizControls";

/** The quiz's section in the control panel: run it, and its questions. */
export function QuizHost(props: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useQuizRun(props.event);
  const running = props.event.current_module === "quiz";

  return (
    <section
      data-testid="quiz-host"
      aria-labelledby="quiz-host-title"
      className="space-y-3"
    >
      <h2 id="quiz-host-title" className="text-lg font-semibold">
        {t("modules.quiz.name")}
      </h2>
      {run.failed && (
        <p role="alert" className="text-sm text-destructive">
          {t("modules.quiz.host.loadFailed")}
        </p>
      )}
      {run.progress && (
        <QuizControls
          {...props}
          progress={run.progress}
          questions={run.questions}
          version={run.version}
        />
      )}
      {!running && run.progress && <QuestionList questions={run.questions} />}
    </section>
  );
}
