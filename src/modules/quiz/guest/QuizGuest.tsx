import { useTranslation } from "react-i18next";
import { useQuizRun } from "@/modules/quiz/useQuizRun";
import type { ModuleGuestViewProps } from "../../types";
import { quizScreen } from "../screen";
import { GuestQuestion } from "./GuestQuestion";

/** The guest page while the quiz runs: answer, then see the result. */
export function QuizGuest({ event, userId }: ModuleGuestViewProps) {
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
        <GuestQuestion
          key={screen.question.id}
          eventId={event.id}
          userId={userId}
          question={screen.question}
          number={screen.number}
          total={screen.total}
          correct={screen.kind === "revealed" ? screen.correct : null}
        />
      )}
      {screen.kind === "results" && (
        <p className="text-2xl font-semibold">{t("modules.quiz.results")}</p>
      )}
    </section>
  );
}
