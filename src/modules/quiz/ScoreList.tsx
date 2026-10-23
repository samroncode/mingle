import { useTranslation } from "react-i18next";
import type { QuizScore } from "@/api/quiz";
import { cn } from "@/lib/utils";

interface ScoreListProps {
  scores: QuizScore[];
  /** Classes for each row, such as its text size. */
  itemClassName?: string;
}

/** Guests with their place and points, best first. Ties share a place. */
export function ScoreList({ scores, itemClassName }: ScoreListProps) {
  const { t } = useTranslation();
  if (scores.length === 0) {
    return (
      <p className="text-muted-foreground">{t("modules.quiz.scores.empty")}</p>
    );
  }
  return (
    <ol data-testid="quiz-scores" className="space-y-2">
      {scores.map((row) => (
        <li
          key={row.userId}
          className={cn(
            "flex items-center gap-4 rounded-lg border px-4 py-3",
            itemClassName,
          )}
        >
          <span className="font-bold">{row.place}</span>
          <span className="min-w-0 flex-1 truncate">{row.displayName}</span>
          <span className="font-semibold">
            {t("modules.quiz.scores.points", { count: row.score })}
          </span>
        </li>
      ))}
    </ol>
  );
}
