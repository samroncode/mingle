import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { optionLetters } from "./screen";

interface QuizOptionsProps {
  options: string[];
  /** The right option once revealed; null before. */
  correct: number | null;
  /** Classes for each option, such as its text size. */
  itemClassName?: string;
}

/** A question's four options, A to D, with the right one marked once revealed. */
export function QuizOptions({
  options,
  correct,
  itemClassName,
}: QuizOptionsProps) {
  const { t } = useTranslation();
  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      {options.map((option, index) => {
        const right = correct === index;
        return (
          <li
            key={index}
            data-correct={right || undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              correct !== null && !right && "opacity-50",
              right && "border-primary bg-primary text-primary-foreground",
              itemClassName,
            )}
          >
            <span className="font-bold">{optionLetters[index]}</span>
            <span>{option}</span>
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
