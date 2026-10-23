import { useEffect } from "react";
import { pickDefaultQuizIds, type QuizAction } from "@/lib/wizard/quiz";
import type { ModuleWizardStepProps } from "../../types";
import { QuizListEditor } from "../QuizListEditor";

/** The quiz step: the picked questions, ready-made ones to add, and your own. */
export function QuizStep({ draft, dispatch }: ModuleWizardStepProps) {
  const { niche, language, quiz } = draft;
  const send = (action: QuizAction) => dispatch({ type: "quiz", action });

  // The default pick happens once, when the step is first reached.
  useEffect(() => {
    if (!quiz.seeded) {
      dispatch({
        type: "quiz",
        action: { type: "seed", ids: pickDefaultQuizIds(niche) },
      });
    }
  }, [quiz.seeded, niche, dispatch]);

  return (
    <QuizListEditor
      niche={niche}
      language={language}
      quiz={quiz}
      dispatch={send}
    />
  );
}
