import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { optionLetters } from "./screen";

interface QuizOptionsProps {
  options: string[];
  /** The right option once revealed; null before. */
  correct: number | null;
  /** How many guests picked each option, shown as a bar once revealed. */
  votes?: number[] | null;
  /** Classes for each option, such as its text size. */
  itemClassName?: string;
}

/** A question's four options, A to D, with the right one marked once revealed. */
export function QuizOptions({
  options,
  correct,
  votes,
  itemClassName,
}: QuizOptionsProps) {
  const { t } = useTranslation();
  const mostVotes = Math.max(1, ...(votes ?? []));
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {options.map((option, index) => {
        const right = correct === index;
        return (
          <li
            key={index}
            data-correct={right || undefined}
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-lg border px-4 py-3",
              correct !== null && !right && "opacity-50",
              right && "border-primary bg-primary text-primary-foreground",
              itemClassName,
            )}
          >
            {votes && (
              <span
                data-testid="quiz-bar"
                aria-hidden
                className="absolute inset-y-0 left-0 bg-current opacity-20"
                style={{ width: `${((votes[index] ?? 0) / mostVotes) * 100}%` }}
              />
            )}
            <span className="relative font-bold">{optionLetters[index]}</span>
            <span className="relative">{option}</span>
            {votes && (
              <span
                data-testid="quiz-votes"
                className="relative ml-auto font-bold"
              >
                {votes[index] ?? 0}
              </span>
            )}
            {right && (
              <span className="sr-only">
                {t("modules.quiz.host.rightAnswer")}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
