import { useEffect } from "react";
import { pickDefaultAwardIds, type AwardsAction } from "@/lib/wizard/awards";
import type { ModuleWizardStepProps } from "../../types";
import { AwardsListEditor } from "../AwardsListEditor";

/** The awards step: the picked categories, ready-made ones to add, your own. */
export function AwardsStep({ draft, dispatch }: ModuleWizardStepProps) {
  const { niche, language, awards } = draft;
  const send = (action: AwardsAction) => dispatch({ type: "awards", action });

  // The default pick happens once, when the step is first reached.
  useEffect(() => {
    if (!awards.seeded) {
      dispatch({
        type: "awards",
        action: { type: "seed", ids: pickDefaultAwardIds(niche) },
      });
    }
  }, [awards.seeded, niche, dispatch]);

  return (
    <AwardsListEditor
      niche={niche}
      language={language}
      awards={awards}
      dispatch={send}
    />
  );
}
