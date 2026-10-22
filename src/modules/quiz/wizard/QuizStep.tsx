import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { quizLimits } from "@/lib/schemas/quiz";
import {
  invalidOwnKeys,
  pickDefaultQuizIds,
  type OwnQuestion,
  type QuizAction,
  type QuizItem,
} from "@/lib/wizard/quiz";
import { getNiche } from "@/niches";
import type { ModuleWizardStepProps } from "../../types";

const optionLetters = ["A", "B", "C", "D"] as const;

/** Move up, move down and remove for one question. */
function QuestionControls({
  index,
  count,
  dispatch,
}: {
  index: number;
  count: number;
  dispatch: (action: QuizAction) => void;
}) {
  const { t } = useTranslation();
  const n = index + 1;
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.quiz.moveUp", { n })}
        disabled={index === 0}
        onClick={() => dispatch({ type: "move", from: index, to: index - 1 })}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.quiz.moveDown", { n })}
        disabled={index === count - 1}
        onClick={() => dispatch({ type: "move", from: index, to: index + 1 })}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.quiz.remove", { n })}
        onClick={() => dispatch({ type: "remove", index })}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/** A ready-made question: its text and which option is the right one. */
function BuiltinQuestion({
  text,
  options,
  correct,
}: {
  text: string;
  options: readonly string[];
  correct: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium">{text}</p>
      <p className="text-sm text-muted-foreground">
        {t("wizard.quiz.rightAnswer", { answer: options[correct] })}
      </p>
    </div>
  );
}

/** The form for one of the host's own questions. */
function OwnQuestionForm({
  own,
  index,
  invalid,
  dispatch,
}: {
  own: OwnQuestion;
  index: number;
  invalid: boolean;
  dispatch: (action: QuizAction) => void;
}) {
  const { t } = useTranslation();
  const n = index + 1;
  const edit = (change: Partial<Omit<OwnQuestion, "key">>) =>
    dispatch({ type: "edit_own", key: own.key, change });
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Input
        value={own.text}
        maxLength={quizLimits.question}
        aria-label={t("wizard.quiz.questionText", { n })}
        aria-invalid={invalid && own.text.trim() === ""}
        placeholder={t("wizard.quiz.questionPlaceholder")}
        onChange={(event) => edit({ text: event.target.value })}
      />
      {optionLetters.map((letter, option) => (
        <div key={letter} className="flex items-center gap-2">
          <input
            type="radio"
            className="size-5 shrink-0 accent-primary"
            name={`correct-${own.key}`}
            checked={own.correct === option}
            aria-label={t("wizard.quiz.markRight", { n, letter })}
            onChange={() => edit({ correct: option })}
          />
          <Input
            value={own.options[option]}
            maxLength={quizLimits.option}
            aria-label={t("wizard.quiz.option", { n, letter })}
            aria-invalid={invalid && (own.options[option] ?? "").trim() === ""}
            placeholder={letter}
            onChange={(event) =>
              edit({
                options: own.options.map((existing, i) =>
                  i === option ? event.target.value : existing,
                ) as OwnQuestion["options"],
              })
            }
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        {t("wizard.quiz.ownHint")}
      </p>
      {invalid && (
        <p role="alert" className="text-sm text-destructive">
          {t("wizard.quiz.errors.incomplete", { n })}
        </p>
      )}
    </div>
  );
}

/** The quiz step: the picked questions, ready-made ones to add, and your own. */
export function QuizStep({ draft, dispatch }: ModuleWizardStepProps) {
  const { t } = useTranslation();
  const { niche, language, quiz } = draft;
  const send = (action: QuizAction) => dispatch({ type: "quiz", action });
  const builtin = new Map(getNiche(niche).quiz.map((q) => [q.id, q]));

  // The default pick happens once, when the step is first reached.
  useEffect(() => {
    if (!quiz.seeded) {
      dispatch({
        type: "quiz",
        action: { type: "seed", ids: pickDefaultQuizIds(niche) },
      });
    }
  }, [quiz.seeded, niche, dispatch]);

  const invalidKeys = new Set(invalidOwnKeys(quiz));
  const full = quiz.items.length >= quizLimits.questions;
  const pickedIds = new Set(
    quiz.items.flatMap((item) => (item.kind === "builtin" ? [item.id] : [])),
  );
  const available = getNiche(niche).quiz.filter((q) => !pickedIds.has(q.id));

  function renderItem(item: QuizItem, index: number) {
    if (item.kind === "own") {
      return (
        <OwnQuestionForm
          own={item}
          index={index}
          invalid={invalidKeys.has(item.key)}
          dispatch={send}
        />
      );
    }
    const content = builtin.get(item.id);
    if (!content) return null;
    const texts = content.texts[language];
    return (
      <BuiltinQuestion
        text={texts.text}
        options={texts.options}
        correct={content.correct}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("wizard.quiz.count", {
          count: quiz.items.length,
          max: quizLimits.questions,
        })}
      </p>

      {quiz.items.length === 0 && quiz.seeded && (
        <p className="text-sm text-muted-foreground">
          {t("wizard.quiz.empty")}
        </p>
      )}

      <ol className="space-y-2">
        {quiz.items.map((item, index) => (
          <li key={item.kind === "own" ? item.key : item.id}>
            <Card className="flex-row items-start gap-1 p-3">
              <span className="w-6 shrink-0 pt-0.5 text-sm text-muted-foreground">
                {index + 1}.
              </span>
              {renderItem(item, index)}
              <QuestionControls
                index={index}
                count={quiz.items.length}
                dispatch={send}
              />
            </Card>
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        size="lg"
        disabled={full}
        onClick={() => send({ type: "add_own", key: crypto.randomUUID() })}
      >
        {t("wizard.quiz.addOwn")}
      </Button>
      {full && (
        <p className="text-sm text-muted-foreground">
          {t("wizard.quiz.full", { max: quizLimits.questions })}
        </p>
      )}

      {available.length > 0 && (
        <section aria-labelledby="quiz-more" className="space-y-2">
          <h2 id="quiz-more" className="text-lg font-semibold">
            {t("wizard.quiz.more")}
          </h2>
          <ul className="space-y-2">
            {available.map((content) => {
              const texts = content.texts[language];
              return (
                <li key={content.id}>
                  <Card className="flex-row items-start gap-2 p-3">
                    <BuiltinQuestion
                      text={texts.text}
                      options={texts.options}
                      correct={content.correct}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={full}
                      aria-label={t("wizard.quiz.addQuestion", {
                        text: texts.text,
                      })}
                      onClick={() =>
                        send({ type: "add_builtin", id: content.id })
                      }
                    >
                      {t("wizard.quiz.add")}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
