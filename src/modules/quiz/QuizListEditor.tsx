import { ErrorLine } from "@/components/ErrorLine";
import { useTranslation } from "react-i18next";
import { PickListEditor } from "@/components/wizard/PickListEditor";
import { Input } from "@/components/ui/input";
import type { Language } from "@/i18n/language";
import { quizLimits } from "@/lib/schemas/quiz";
import {
  invalidOwnKeys,
  type OwnQuestion,
  type QuizAction,
  type QuizDraft,
  type QuizItem,
} from "@/lib/wizard/quiz";
import { getNiche, type NicheId } from "@/niches";
import { optionLetters } from "./screen";

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
      <p className="text-sm text-on-paper-muted">
        {t("wizard.quiz.rightAnswer", { answer: options[correct] })}
      </p>
    </div>
  );
}

/** The form for one of the host's own questions. */
function OwnQuestionForm({
  own,
  n,
  invalid,
  dispatch,
}: {
  own: OwnQuestion;
  /** The question's number as shown. */
  n: number;
  invalid: boolean;
  dispatch: (action: QuizAction) => void;
}) {
  const { t } = useTranslation();
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
        <ErrorLine>{t("wizard.quiz.errors.incomplete", { n })}</ErrorLine>
      )}
    </div>
  );
}

interface QuizListEditorProps {
  niche: NicheId;
  language: Language;
  quiz: QuizDraft;
  dispatch: (action: QuizAction) => void;
  /** Played questions shown locked before the list; they count in the limit. */
  lockedCount?: number;
  /** Ready-made questions not to offer, such as ones already played. */
  hiddenIds?: readonly string[];
}

/**
 * The quiz's question list as the host edits it, in the wizard and in the
 * control panel: the questions in order, ready-made ones to add, and the
 * host's own.
 */
export function QuizListEditor({
  niche,
  language,
  quiz,
  dispatch,
  lockedCount = 0,
  hiddenIds = [],
}: QuizListEditorProps) {
  const { t } = useTranslation();
  const content = getNiche(niche).quiz;
  const builtin = new Map(content.map((q) => [q.id, q]));
  const invalidKeys = new Set(invalidOwnKeys(quiz));
  const leftOut = new Set([
    ...hiddenIds,
    ...quiz.items.flatMap((item) => (item.kind === "builtin" ? [item.id] : [])),
  ]);
  const number = (index: number) => lockedCount + index + 1;

  function renderItem(item: QuizItem, index: number) {
    if (item.kind === "own") {
      return (
        <OwnQuestionForm
          own={item}
          n={number(index)}
          invalid={invalidKeys.has(item.key)}
          dispatch={dispatch}
        />
      );
    }
    const ready = builtin.get(item.id);
    if (!ready) return null;
    const texts = ready.texts[language];
    return (
      <BuiltinQuestion
        text={texts.text}
        options={texts.options}
        correct={ready.correct}
      />
    );
  }

  const available = content
    .filter((q) => !leftOut.has(q.id))
    .map((ready) => {
      const texts = ready.texts[language];
      return {
        id: ready.id,
        addLabel: t("wizard.quiz.addQuestion", { text: texts.text }),
        content: (
          <BuiltinQuestion
            text={texts.text}
            options={texts.options}
            correct={ready.correct}
          />
        ),
      };
    });

  return (
    <PickListEditor
      id="quiz"
      items={quiz.items}
      seeded={quiz.seeded}
      limit={quizLimits.questions - lockedCount}
      firstNumber={lockedCount + 1}
      labels={{
        count: t("wizard.quiz.count", {
          count: lockedCount + quiz.items.length,
          max: quizLimits.questions,
        }),
        empty: t("wizard.quiz.empty"),
        addOwn: t("wizard.quiz.addOwn"),
        full: t("wizard.quiz.full", { max: quizLimits.questions }),
        more: t("wizard.quiz.more"),
        add: t("wizard.quiz.add"),
        moveUp: (n) => t("wizard.quiz.moveUp", { n }),
        moveDown: (n) => t("wizard.quiz.moveDown", { n }),
        remove: (n) => t("wizard.quiz.remove", { n }),
      }}
      available={available}
      renderItem={renderItem}
      dispatch={dispatch}
    />
  );
}
