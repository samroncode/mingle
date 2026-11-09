import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import type { ModuleLiveProps } from "../../types";
import { RunControls } from "../../RunControls";
import { hostNextMove } from "../screen";
import { useQuizRun } from "../useQuizRun";
import { AnswerStatus } from "./AnswerStatus";
import { QuestionCard } from "./QuestionList";

/**
 * The running quiz: the question, who has answered, and the one "next"
 * button with Stop. Renders nothing while the quiz is not running.
 */
export function QuizLive({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  part = "all",
}: ModuleLiveProps) {
  const { t } = useTranslation();
  const run = useQuizRun(event);
  if (event.current_module !== "quiz") return null;
  if (!run.progress) {
    return run.failed ? (
      <ErrorLine>{t("modules.quiz.host.loadFailed")}</ErrorLine>
    ) : null;
  }
  const { total } = run.progress;
  const next = hostNextMove(event, total);
  const current = run.questions.find((q) => q.position === event.current_step);

  return (
    <div data-testid="quiz-live" className="space-y-3">
      {part !== "actions" && (
        <>
          <p data-testid="quiz-progress" className="text-sm text-ink-muted">
            {next
              ? t("modules.quiz.counter", {
                  number: event.current_step + 1,
                  total,
                })
              : t("modules.quiz.results")}
          </p>
          {current && next && <QuestionCard question={current} />}
          {current && next && event.phase !== "idle" && (
            <AnswerStatus
              question={current}
              members={members}
              version={run.version}
            />
          )}
        </>
      )}
      {part !== "status" && (
        <RunControls
          code={code}
          hostKey={hostKey}
          module="quiz"
          running
          startDisabled={startDisabled}
          startLabelKey="modules.quiz.run.start"
          next={next}
          stopLabelKey={next ? undefined : "modules.quiz.run.backToParty"}
        />
      )}
    </div>
  );
}
