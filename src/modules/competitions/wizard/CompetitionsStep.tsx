import type { CompetitionsAction } from "@/lib/wizard/competitions";
import type { ModuleWizardStepProps } from "../../types";
import { CompetitionsListEditor } from "../CompetitionsListEditor";

/** The competitions step: the suggestions to tick, and your own. */
export function CompetitionsStep({ draft, dispatch }: ModuleWizardStepProps) {
  const { niche, language, competitions } = draft;
  const send = (action: CompetitionsAction) =>
    dispatch({ type: "competitions", action });

  return (
    <CompetitionsListEditor
      niche={niche}
      language={language}
      list={competitions}
      dispatch={send}
    />
  );
}
