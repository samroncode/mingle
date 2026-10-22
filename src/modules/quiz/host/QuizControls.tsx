import { useState } from "react";
import { useTranslation } from "react-i18next";
import { setFlow } from "@/api/host-actions";
import type { FlowMove } from "@/lib/schemas/host-actions";
import { Button } from "@/components/ui/button";
import type { QuizProgress, QuizQuestionView } from "@/api/quiz";
import { hostPanelErrorKey } from "@/lib/host-panel";
import type { ModuleHostProps } from "../../types";
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

/** Sends one flow move at a time and keeps its error message. */
function useMove(code: string, hostKey: string) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function send(move: FlowMove) {
    setBusy(true);
    setError(undefined);
    const result = await setFlow({ code, key: hostKey, move });
    setBusy(false);
    if (!result.ok) setError(t(hostPanelErrorKey(result.error)));
  }

  return { busy, error, send: (move: FlowMove) => void send(move) };
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
  const { busy, error, send } = useMove(code, hostKey);
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
      <div className="flex flex-wrap gap-2">
        {running ? (
          <>
            {next && (
              <Button
                size="lg"
                disabled={busy}
                onClick={() => send({ type: next.move })}
              >
                {t(next.labelKey)}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              disabled={busy}
              onClick={() => send({ type: "stop_module" })}
            >
              {t("hostPanel.stop")}
            </Button>
          </>
        ) : (
          <Button
            size="lg"
            disabled={busy || startDisabled}
            onClick={() => send({ type: "start_module", module: "quiz" })}
          >
            {t("modules.quiz.run.start")}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
