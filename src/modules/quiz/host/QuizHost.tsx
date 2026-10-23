import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { isLanguage } from "@/i18n/language";
import { canEditQuiz } from "@/lib/host/quiz-edit";
import { isNicheId } from "@/niches";
import { useQuizRun } from "@/modules/quiz/useQuizRun";
import { useQuizScores } from "@/modules/quiz/useQuizScores";
import type { ModuleHostProps } from "../../types";
import { ScoreList } from "../ScoreList";
import { QuestionList } from "./QuestionList";
import { QuizControls } from "./QuizControls";
import { QuizEdit } from "./QuizEdit";

/** The quiz's section in the control panel: run it, and its questions. */
export function QuizHost(props: ModuleHostProps) {
  const { t } = useTranslation();
  const run = useQuizRun(props.event);
  const [editing, setEditing] = useState(false);
  const { event } = props;
  const running = event.current_module === "quiz";
  // The full list once every question is played: on the results step, and
  // after Back to party screen.
  const finished =
    !!run.progress &&
    run.progress.total > 0 &&
    run.progress.played >= run.progress.total;
  const scores = useQuizScores(event.id, finished, run.version);
  const niche = isNicheId(event.niche) ? event.niche : undefined;
  const language = isLanguage(event.language) ? event.language : undefined;
  const editable =
    !!run.progress && !!niche && !!language && canEditQuiz(event, run.progress);

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
      {finished && scores && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t("modules.quiz.scores.all")}</h3>
          <ScoreList scores={scores} />
        </div>
      )}
      {editing && niche && language ? (
        <QuizEdit
          event={event}
          niche={niche}
          language={language}
          hostKey={props.hostKey}
          questions={run.questions}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          {editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
            >
              {t("modules.quiz.edit.edit")}
            </Button>
          )}
          {!running && run.progress && (
            <QuestionList questions={run.questions} />
          )}
        </>
      )}
    </section>
  );
}
