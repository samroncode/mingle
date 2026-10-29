import { useTranslation } from "react-i18next";
import type { MemberRow } from "@/api/events";
import type { QuizQuestionView } from "@/api/quiz";
import { useQuizAnswerers } from "@/modules/quiz/useQuizAnswerers";

interface AnswerStatusProps {
  question: QuizQuestionView;
  members: MemberRow[];
  version: number;
}

/** "7 of 12 answered", and who has answered by name, never what. */
export function AnswerStatus({
  question,
  members,
  version,
}: AnswerStatusProps) {
  const { t } = useTranslation();
  const answerers = new Set(useQuizAnswerers(question.id, version));
  const guests = members.filter((m) => m.role === "guest");
  const names = guests
    .filter((m) => answerers.has(m.user_id))
    .map((m) => m.display_name);

  return (
    <div data-testid="quiz-answered" className="space-y-1">
      <p className="text-sm font-bold">
        {t("modules.quiz.answered", {
          count: question.answerCount,
          total: guests.length,
        })}
      </p>
      {names.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {names.map((name) => (
            <li
              key={name}
              className="rounded-sm border-[length:var(--border-thin)] border-line bg-surface-sunken px-2 py-0.5 text-ink"
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
