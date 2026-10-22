import { useTranslation } from "react-i18next";

/** Placeholder until the quiz's phone screens are built. */
export function QuizGuest() {
  const { t } = useTranslation();
  return (
    <section data-testid="quiz-guest" className="text-2xl font-semibold">
      {t("modules.quiz.name")}
    </section>
  );
}
