import type { Language } from "@/i18n/language";
import type { CreateEventRequest } from "@/lib/schemas/host-actions";
import type { Party } from "@/lib/schemas/party";
import type { ModuleId } from "@/modules/registry";
import { getNiche, type NicheId } from "@/niches";
import { nicheIds } from "@/niches/ids";

/**
 * The setup wizard's steps, in order. Later tickets add the party-screen
 * steps between "activities" and "summary".
 */
export const stepOrder = [
  "niche",
  "language",
  "activities",
  "summary",
] as const;
export type WizardStep = (typeof stepOrder)[number];

/** Everything the host has typed so far, plus where they are. */
export interface WizardDraft {
  step: WizardStep;
  niche: NicheId;
  language: Language;
  enabledModules: ModuleId[];
  party: Party;
}

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "go_to"; step: WizardStep }
  | { type: "select_niche"; niche: NicheId }
  | { type: "set_language"; language: Language }
  | { type: "toggle_module"; module: ModuleId }
  | { type: "set_party"; party: Party };

const firstNiche: NicheId = nicheIds[0];

/** A fresh draft: the first niche, its default activities, no party content. */
export function initialDraft(language: Language): WizardDraft {
  return {
    step: stepOrder[0],
    niche: firstNiche,
    language,
    enabledModules: [...getNiche(firstNiche).defaultModules],
    party: {},
  };
}

function moveStep(step: WizardStep, offset: number): WizardStep {
  const index = stepOrder.indexOf(step) + offset;
  const clamped = Math.min(Math.max(index, 0), stepOrder.length - 1);
  return stepOrder[clamped] ?? step;
}

export function wizardReducer(
  draft: WizardDraft,
  action: WizardAction,
): WizardDraft {
  switch (action.type) {
    case "next":
      return { ...draft, step: moveStep(draft.step, 1) };
    case "back":
      return { ...draft, step: moveStep(draft.step, -1) };
    case "go_to":
      return { ...draft, step: action.step };
    case "select_niche":
      return {
        ...draft,
        niche: action.niche,
        enabledModules: [...getNiche(action.niche).defaultModules],
      };
    case "set_language":
      return { ...draft, language: action.language };
    case "toggle_module":
      return {
        ...draft,
        enabledModules: draft.enabledModules.includes(action.module)
          ? draft.enabledModules.filter((id) => id !== action.module)
          : [...draft.enabledModules, action.module],
      };
    case "set_party":
      return { ...draft, party: action.party };
  }
}

/** The input for `createEvent`: the `create_event` request without its action. */
export function toCreateInput(
  draft: WizardDraft,
): Omit<CreateEventRequest, "action"> {
  return {
    niche: draft.niche,
    language: draft.language,
    enabledModules: draft.enabledModules,
    party: draft.party,
  };
}

/** The full request body, in the shape the `create_event` schema checks. */
export function toCreateRequest(draft: WizardDraft): CreateEventRequest {
  return { action: "create_event", ...toCreateInput(draft) };
}
