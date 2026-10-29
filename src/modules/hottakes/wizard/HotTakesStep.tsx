import { useEffect } from "react";
import {
  pickDefaultHotTakeIds,
  type HotTakesAction,
} from "@/lib/wizard/hottakes";
import type { ModuleWizardStepProps } from "../../types";
import { HotTakesListEditor } from "../HotTakesListEditor";

/** The hot takes step: the picked hot takes, ready-made ones to add, your own. */
export function HotTakesStep({ draft, dispatch }: ModuleWizardStepProps) {
  const { niche, language, hottakes } = draft;
  const send = (action: HotTakesAction) =>
    dispatch({ type: "hottakes", action });

  // The default pick happens once, when the step is first reached.
  useEffect(() => {
    if (!hottakes.seeded) {
      dispatch({
        type: "hottakes",
        action: { type: "seed", ids: pickDefaultHotTakeIds(niche) },
      });
    }
  }, [hottakes.seeded, niche, dispatch]);

  return (
    <HotTakesListEditor
      niche={niche}
      language={language}
      takes={hottakes}
      dispatch={send}
    />
  );
}
