import { ErrorLine } from "@/components/ErrorLine";
import { Lock } from "lucide-react";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow } from "@/api/events";
import { updateQuiz } from "@/api/host-actions";
import type { QuizQuestionView } from "@/api/quiz";
import { Button } from "@/components/ui/button";
import { useHostAction } from "@/hooks/useHostAction";
import type { Language } from "@/i18n/language";
import {
  quizEditErrorKey,
  quizToDraft,
  saveQuizEdit,
} from "@/lib/host/quiz-edit";
import { quizReducer } from "@/lib/wizard/quiz";
import type { NicheId } from "@/niches";
import { QuizListEditor } from "../QuizListEditor";
import { QuestionCard } from "./QuestionList";

interface QuizEditProps {
  event: EventRow;
  niche: NicheId;
  language: Language;
  hostKey: string;
  /** Every question of the quiz, as the host reads them. */
  questions: QuizQuestionView[];
  onDone: () => void;
}

/**
 * The control panel's quiz editor: played questions locked, the rest in the
 * wizard's quiz editor. Saving replaces every unplayed question.
 */
export function QuizEdit({
  event,
  niche,
  language,
  hostKey,
  questions,
  onDone,
}: QuizEditProps) {
  const { t } = useTranslation();
  // Read once: the list the host edits doesn't change under their fingers.
  const [start] = useState(() => quizToDraft(niche, language, questions));
  const [quiz, dispatch] = useReducer(quizReducer, start.draft);
  const [incomplete, setIncomplete] = useState(false);
  const { busy, error, run } = useHostAction(quizEditErrorKey);

  async function save() {
    const result = await run(() =>
      saveQuizEdit(
        niche,
        language,
        quiz,
        { code: event.code, key: hostKey },
        updateQuiz,
      ),
    );
    setIncomplete("invalid" in result);
    if (result.ok) onDone();
  }

  return (
    <div data-testid="quiz-edit" className="space-y-4">
      {start.played.length > 0 && (
        <ol className="space-y-2" aria-label={t("modules.quiz.edit.played")}>
          {start.played.map((question, index) => (
            <li key={question.id}>
              <QuestionCard question={{ ...question, position: index }} />
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <Lock aria-hidden className="size-3" />
                {t("modules.quiz.edit.locked")}
              </p>
            </li>
          ))}
        </ol>
      )}
      <QuizListEditor
        niche={niche}
        language={language}
        quiz={quiz}
        dispatch={dispatch}
        lockedCount={start.played.length}
        hiddenIds={start.hiddenIds}
      />
      {(error ?? incomplete) && (
        <ErrorLine>
          {error ?? t("modules.quiz.edit.errors.incomplete")}
        </ErrorLine>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="lg" disabled={busy} onClick={() => void save()}>
          {t("modules.quiz.edit.save")}
        </Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={onDone}>
          {t("modules.quiz.edit.cancel")}
        </Button>
      </div>
    </div>
  );
}
