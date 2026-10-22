import { useTranslation } from "react-i18next";

/** Placeholder until the quiz's control panel section is built. */
export function QuizHost() {
  const { t } = useTranslation();
  return (
    <section data-testid="quiz-host" className="font-semibold">
      {t("modules.quiz.name")}
    </section>
  );
}
