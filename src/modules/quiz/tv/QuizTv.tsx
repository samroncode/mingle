import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/modules/quiz/useQuizRun";
import { useQuizScores } from "@/modules/quiz/useQuizScores";
import { useQuizVotes } from "@/modules/quiz/useQuizVotes";
import type { ModuleViewProps } from "../../types";
import { QuizOptions } from "../QuizOptions";
import { ScoreList } from "../ScoreList";
import { quizScreen } from "../screen";
import { TvCounter, TvStage } from "../../TvStage";

/** The left side of the TV while the quiz runs. */
export function QuizTv({ event, members }: ModuleViewProps) {
  const { t } = useTranslation();
  const run = useQuizRun(event);
  const screen = quizScreen(event, run.progress, run.questions);
  const shown =
    screen.kind === "open" || screen.kind === "revealed"
      ? screen.question
      : undefined;
  const votes = useQuizVotes(shown?.id, screen.kind === "revealed");
  // The top 3 places exist only once the quiz is finished; there are no
  // standings between questions.
  const scores = useQuizScores(
    event.id,
    screen.kind === "results",
    run.version,
  );
  const guests = members.filter((m) => m.role === "guest").length;

  return (
    <TvStage
      data-testid="quiz-tv"
      data-screen={screen.kind}
      moment={screen.kind === "revealed" || screen.kind === "results"}
      momentKey={`${screen.kind}-${shown?.id ?? ""}`}
    >
      {screen.kind === "loading" && (
        <p className="font-display text-6xl font-extrabold">
          {t("modules.quiz.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <>
          <TvCounter>
            {t("modules.quiz.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <p className="tv-float font-display text-8xl leading-none font-extrabold">
            {t("modules.quiz.tv.ready")}
          </p>
        </>
      )}
      {(screen.kind === "open" || screen.kind === "revealed") && (
        <>
          <TvCounter>
            {t("modules.quiz.counter", {
              number: screen.number,
              total: screen.total,
            })}
          </TvCounter>
          <h2 className="font-display text-6xl leading-tight font-extrabold">
            {screen.question.text}
          </h2>
          <QuizOptions
            options={screen.question.options}
            correct={screen.kind === "revealed" ? screen.correct : null}
            votes={votes}
            itemClassName="py-6 text-4xl"
          />
          {screen.kind === "open" && (
            <p
              data-testid="quiz-answered"
              className="font-display text-4xl font-bold"
            >
              {t("modules.quiz.answered", {
                count: screen.question.answerCount,
                total: guests,
              })}
            </p>
          )}
        </>
      )}
      {screen.kind === "results" && (
        <>
          <h2 className="font-display text-7xl font-extrabold">
            {t("modules.quiz.scores.title")}
          </h2>
          {scores && (
            <ScoreList scores={scores} itemClassName="py-6 text-5xl" />
          )}
        </>
      )}
    </TvStage>
  );
}
