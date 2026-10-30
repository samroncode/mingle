import { useTranslation } from "react-i18next";
import type { QuizScore } from "@/api/quiz";
import { cn } from "@/lib/utils";

interface ScoreListProps {
  scores: QuizScore[];
  /** Classes for each row, such as its text size. */
  itemClassName?: string;
}

/** The places that get a bright fill: champagne first, then blush and sage. */
const placeFills = ["bg-champagne", "bg-blush", "bg-sage"] as const;

/** Guests with their place and points, best first. Ties share a place. */
export function ScoreList({ scores, itemClassName }: ScoreListProps) {
  const { t } = useTranslation();
  if (scores.length === 0) {
    return (
      <p className="text-on-paper-muted">{t("modules.quiz.scores.empty")}</p>
    );
  }
  return (
    <ol data-testid="quiz-scores" className="space-y-3">
      {scores.map((row) => {
        const fill = placeFills[row.place - 1];
        return (
          <li
            key={row.userId}
            className={cn(
              "flex items-center gap-4 rounded-md border-[length:var(--border-thin)] border-edge px-4 py-3 font-display font-bold",
              fill ? `${fill} text-on-bright` : "bg-paper text-on-paper",
              itemClassName,
            )}
          >
            <span className="w-[1.2em] text-center font-extrabold">
              {row.place}
            </span>
            <span className="min-w-0 flex-1 truncate">{row.displayName}</span>
            <span className="font-extrabold">
              {t("modules.quiz.scores.points", { count: row.score })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
