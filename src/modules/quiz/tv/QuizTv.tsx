import { useTranslation } from "react-i18next";

/** Placeholder until the quiz's TV screens are built. */
export function QuizTv() {
  const { t } = useTranslation();
  return (
    <section data-testid="quiz-tv" className="text-7xl font-semibold">
      {t("modules.quiz.name")}
    </section>
  );
}
