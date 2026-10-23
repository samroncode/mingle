import { useTranslation } from "react-i18next";
import type { QuizProgress, QuizQuestionView } from "@/api/quiz";
import type { ModuleHostProps } from "../../types";
import { RunControls } from "../../RunControls";
import { hostNextMove } from "../screen";
import { AnswerStatus } from "./AnswerStatus";
import { QuestionCard } from "./QuestionList";

interface QuizControlsProps extends ModuleHostProps {
  progress: QuizProgress;
  /** Every question, with its right option (the host reads them all). */
  questions: QuizQuestionView[];
  /** Changes when the quiz data was read again, to refresh who answered. */
  version: number;
}

/** Start, the one button that does the next thing, Stop and the question. */
export function QuizControls({
  event,
  members,
  code,
  hostKey,
  startDisabled,
  progress,
  questions,
  version,
}: QuizControlsProps) {
  const { t } = useTranslation();
  const { total, played } = progress;
  const running = event.current_module === "quiz";
  const next = hostNextMove(event, total);
  const current = running
    ? questions.find((q) => q.position === event.current_step)
    : undefined;

  return (
    <div className="space-y-3">
      {running ? (
        <p
          data-testid="quiz-progress"
          className="text-sm text-muted-foreground"
        >
          {next
            ? t("modules.quiz.counter", {
                number: event.current_step + 1,
                total,
              })
            : t("modules.quiz.results")}
        </p>
      ) : (
        total > 0 &&
        played >= total && (
          <p className="text-sm text-muted-foreground">
            {t("modules.quiz.run.finished")}
          </p>
        )
      )}
      {current && next && <QuestionCard question={current} />}
      {current && next && event.phase !== "idle" && (
        <AnswerStatus question={current} members={members} version={version} />
      )}
      <RunControls
        code={code}
        hostKey={hostKey}
        module="quiz"
        running={running}
        startDisabled={startDisabled}
        startLabelKey="modules.quiz.run.start"
        next={next}
        stopLabelKey={next ? undefined : "modules.quiz.run.backToParty"}
      />
    </div>
  );
}
