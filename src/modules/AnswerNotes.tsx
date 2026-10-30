import { useTranslation } from "react-i18next";

interface AnswerNotesProps {
  answered: number;
  total: number;
}

/** Under the answers while an item is open: who has answered, and that it can change. */
export function AnswerNotes({ answered, total }: AnswerNotesProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 text-base text-ink-muted">
      <p data-testid="answer-count">
        {t("guest.answered", { count: answered, total })}
      </p>
      <p>{t("guest.canChange")}</p>
    </div>
  );
}
