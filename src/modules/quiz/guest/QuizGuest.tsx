import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/modules/quiz/useQuizRun";
import { useQuizScores } from "@/modules/quiz/useQuizScores";
import type { ModuleGuestViewProps } from "../../types";
import { quizScreen } from "../screen";
import { GuestQuestion } from "./GuestQuestion";

/** The guest page while the quiz runs: answer, then see the result. */
export function QuizGuest({ event, userId }: ModuleGuestViewProps) {
  const { t } = useTranslation();
  const run = useQuizRun(event);
  const screen = quizScreen(event, run.progress, run.questions);
  const scores = useQuizScores(
    event.id,
    screen.kind === "revealed" || screen.kind === "results",
    run.version,
  );
  const mine = scores?.find((row) => row.userId === userId);

  return (
    <section
      data-testid="quiz-guest"
      data-screen={screen.kind}
      className="space-y-4"
    >
      {screen.kind === "loading" && (
        <p className="font-display text-3xl font-extrabold">
          {t("modules.quiz.name")}
        </p>
      )}
      {screen.kind === "idle" && (
        <p className="font-display text-3xl font-extrabold">
          {t("modules.quiz.guest.coming")}
        </p>
      )}
      {(screen.kind === "open" || screen.kind === "revealed") && (
        <GuestQuestion
          key={screen.question.id}
          eventId={event.id}
          userId={userId}
          question={screen.question}
          number={screen.number}
          total={screen.total}
          correct={screen.kind === "revealed" ? screen.correct : null}
          score={screen.kind === "revealed" ? mine?.score : undefined}
        />
      )}
      {screen.kind === "results" && (
        <>
          <h2 className="font-display text-3xl font-extrabold">
            {t("modules.quiz.scores.title")}
          </h2>
          {mine && (
            <div
              data-testid="quiz-final"
              className="fun-pop space-y-1 rounded-lg border-[length:var(--border-thin)] border-edge bg-champagne p-4 text-on-bright"
            >
              <p className="font-display text-6xl leading-none font-extrabold">
                {t("modules.quiz.guest.finalPlace", { place: mine.place })}
              </p>
              <p className="text-lg font-medium">
                {t("modules.quiz.guest.finalScore", { count: mine.score })}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
