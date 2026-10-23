import type { Language } from "@/i18n/language";
import type { CreateEventRequest } from "@/lib/schemas/host-actions";
import { PartySchema, type Party } from "@/lib/schemas/party";
import type { ModuleId } from "@/modules/registry";
import { getNiche, type NicheId } from "@/niches";
import { nicheIds } from "@/niches/ids";
import {
  emptyQuiz,
  invalidOwnKeys,
  quizReducer,
  resetBuiltinQuiz,
  toQuizQuestions,
  type QuizAction,
  type QuizDraft,
} from "./quiz";
import {
  awardsReducer,
  emptyAwards,
  invalidOwnAwardKeys,
  resetBuiltinAwards,
  toAwardCategories,
  type AwardsAction,
  type AwardsDraft,
} from "./awards";

/** The setup wizard's steps, in order. */
export const stepOrder = [
  "niche",
  "language",
  "activities",
  "quiz",
  "awards",
  "welcome",
  "menu",
  "schedule",
  "wifi",
  "summary",
] as const;
export type WizardStep = (typeof stepOrder)[number];

/** Steps the host can skip: every step after language. */
export function isSkippable(step: WizardStep): boolean {
  return stepOrder.indexOf(step) > stepOrder.indexOf("language");
}

/** The steps that belong to an activity, shown only while it is on. */
const moduleSteps: Partial<Record<WizardStep, ModuleId>> = {
  quiz: "quiz",
  awards: "awards",
};

/**
 * The steps this draft goes through, in order: an activity's step (quiz,
 * awards) only appears while that activity is switched on.
 */
export function stepsFor(draft: WizardDraft): WizardStep[] {
  return stepOrder.filter((step) => {
    const module = moduleSteps[step];
    return module === undefined || draft.enabledModules.includes(module);
  });
}

export interface ScheduleLine {
  time: string;
  title: string;
}

/**
 * The party-screen content as typed, before it is checked. Plain data, so it
 * can be saved as JSON. Empty or partly filled parts are allowed here.
 */
export interface PartyForm {
  welcome: string;
  /** False while the welcome text still follows niche and language. */
  welcomeEdited: boolean;
  menu: string[];
  schedule: ScheduleLine[];
  wifiSsid: string;
  wifiPassword: string;
  musicUrl: string;
}

/** Everything the host has typed so far, plus where they are. */
export interface WizardDraft {
  step: WizardStep;
  niche: NicheId;
  language: Language;
  enabledModules: ModuleId[];
  quiz: QuizDraft;
  awards: AwardsDraft;
  party: PartyForm;
}

export type WizardAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "go_to"; step: WizardStep }
  | { type: "select_niche"; niche: NicheId }
  | { type: "set_language"; language: Language }
  | { type: "toggle_module"; module: ModuleId }
  | { type: "quiz"; action: QuizAction }
  | { type: "awards"; action: AwardsAction }
  | { type: "skip" }
  | { type: "set_welcome"; text: string }
  | { type: "set_menu"; menu: string[] }
  | { type: "set_schedule"; schedule: ScheduleLine[] }
  | { type: "set_wifi"; ssid: string; password: string }
  | { type: "set_music_url"; url: string };

const firstNiche: NicheId = nicheIds[0];

function emptyParty(niche: NicheId, language: Language): PartyForm {
  return {
    welcome: getNiche(niche).welcome[language],
    welcomeEdited: false,
    menu: [],
    schedule: [],
    wifiSsid: "",
    wifiPassword: "",
    musicUrl: "",
  };
}

/** A fresh draft: the first niche, its default activities and welcome text. */
export function initialDraft(language: Language): WizardDraft {
  return {
    step: stepOrder[0],
    niche: firstNiche,
    language,
    enabledModules: [...getNiche(firstNiche).defaultModules],
    quiz: emptyQuiz,
    awards: emptyAwards,
    party: emptyParty(firstNiche, language),
  };
}

/** Keeps an unedited welcome text in step with the niche and language. */
function followWelcome(draft: WizardDraft): WizardDraft {
  if (draft.party.welcomeEdited) return draft;
  const welcome = getNiche(draft.niche).welcome[draft.language];
  return { ...draft, party: { ...draft.party, welcome } };
}

function withParty(draft: WizardDraft, part: Partial<PartyForm>): WizardDraft {
  return { ...draft, party: { ...draft.party, ...part } };
}

/**
 * Puts a step back to its default. Most steps become empty and are left out
 * of the request; the welcome step goes back to the niche's ready text, so a
 * host who skips everything still gets a good TV.
 */
function clearStep(draft: WizardDraft): WizardDraft {
  switch (draft.step) {
    case "welcome":
      return followWelcome(withParty(draft, { welcomeEdited: false }));
    case "menu":
      return withParty(draft, { menu: [] });
    case "schedule":
      return withParty(draft, { schedule: [] });
    case "wifi":
      return withParty(draft, {
        wifiSsid: "",
        wifiPassword: "",
        musicUrl: "",
      });
    default:
      return draft;
  }
}

function moveStep(draft: WizardDraft, offset: number): WizardStep {
  const steps = stepsFor(draft);
  // A step that is switched off (an activity's) counts as the one before it.
  const current = Math.max(
    steps.findIndex(
      (step) => stepOrder.indexOf(step) >= stepOrder.indexOf(draft.step),
    ),
    0,
  );
  const clamped = Math.min(Math.max(current + offset, 0), steps.length - 1);
  return steps[clamped] ?? draft.step;
}

export function wizardReducer(
  draft: WizardDraft,
  action: WizardAction,
): WizardDraft {
  switch (action.type) {
    case "next":
      return { ...draft, step: moveStep(draft, 1) };
    case "back":
      return { ...draft, step: moveStep(draft, -1) };
    case "go_to":
      return { ...draft, step: action.step };
    case "select_niche":
      return followWelcome({
        ...draft,
        niche: action.niche,
        enabledModules: [...getNiche(action.niche).defaultModules],
        quiz:
          action.niche === draft.niche
            ? draft.quiz
            : resetBuiltinQuiz(draft.quiz),
        awards:
          action.niche === draft.niche
            ? draft.awards
            : resetBuiltinAwards(draft.awards),
      });
    case "set_language":
      return followWelcome({ ...draft, language: action.language });
    case "toggle_module":
      return {
        ...draft,
        enabledModules: draft.enabledModules.includes(action.module)
          ? draft.enabledModules.filter((id) => id !== action.module)
          : [...draft.enabledModules, action.module],
      };
    case "quiz":
      return { ...draft, quiz: quizReducer(draft.quiz, action.action) };
    case "awards":
      return {
        ...draft,
        awards: awardsReducer(draft.awards, action.action),
      };
    case "skip": {
      const cleared = clearStep(draft);
      return { ...cleared, step: moveStep(cleared, 1) };
    }
    case "set_welcome":
      return withParty(draft, { welcome: action.text, welcomeEdited: true });
    case "set_menu":
      return withParty(draft, { menu: action.menu });
    case "set_schedule":
      return withParty(draft, { schedule: action.schedule });
    case "set_wifi":
      return withParty(draft, {
        wifiSsid: action.ssid,
        wifiPassword: action.password,
      });
    case "set_music_url":
      return withParty(draft, { musicUrl: action.url });
  }
}

/** The party content as the request carries it: empty parts are left out. */
export function toParty(form: PartyForm): Party {
  const party: Party = {};
  const welcome = form.welcome.trim();
  if (welcome) party.welcome = welcome;
  const menu = form.menu.map((line) => line.trim()).filter(Boolean);
  if (menu.length > 0) party.menu = menu;
  const schedule = form.schedule
    .map((line) => ({ time: line.time.trim(), title: line.title.trim() }))
    .filter((line) => line.time || line.title);
  if (schedule.length > 0) party.schedule = schedule;
  const ssid = form.wifiSsid.trim();
  if (ssid || form.wifiPassword) {
    party.wifi = { ssid, password: form.wifiPassword };
  }
  const musicUrl = form.musicUrl.trim();
  if (musicUrl) party.musicUrl = musicUrl;
  return party;
}

/** A part of the party content that can be invalid. */
export type PartyField = "welcome" | "menu" | "schedule" | "wifi" | "musicUrl";

const fieldStep: Record<PartyField, WizardStep> = {
  welcome: "welcome",
  menu: "menu",
  schedule: "schedule",
  wifi: "wifi",
  musicUrl: "wifi",
};

/** The parts of the party content that break the shared party schema. */
export function invalidFields(form: PartyForm): PartyField[] {
  const result = PartySchema.safeParse(toParty(form));
  if (result.success) return [];
  const fields = result.error.issues.map((issue) => issue.path[0]);
  return (Object.keys(fieldStep) as PartyField[]).filter((field) =>
    fields.includes(field),
  );
}

/** The invalid parts on one step; Next is blocked while this isn't empty. */
export function stepInvalidFields(
  form: PartyForm,
  step: WizardStep,
): PartyField[] {
  return invalidFields(form).filter((field) => fieldStep[field] === step);
}

/**
 * The first step, in step order, that holds an invalid part, or undefined
 * when everything is valid. Create sends the host there instead of sending.
 */
export function firstInvalidStep(form: PartyForm): WizardStep | undefined {
  const steps = new Set(invalidFields(form).map((field) => fieldStep[field]));
  return stepOrder.find((step) => steps.has(step));
}

/** Whether the quiz step has questions that break the shared schema. */
export function quizIsInvalid(draft: WizardDraft): boolean {
  return (
    draft.enabledModules.includes("quiz") &&
    invalidOwnKeys(draft.quiz).length > 0
  );
}

/** Whether the awards step has categories that break the shared schema. */
export function awardsIsInvalid(draft: WizardDraft): boolean {
  return (
    draft.enabledModules.includes("awards") &&
    invalidOwnAwardKeys(draft.awards).length > 0
  );
}

/** Whether the step holds something invalid; Next is blocked while it does. */
export function stepIsInvalid(draft: WizardDraft, step: WizardStep): boolean {
  if (step === "quiz") return quizIsInvalid(draft);
  if (step === "awards") return awardsIsInvalid(draft);
  return stepInvalidFields(draft.party, step).length > 0;
}

/**
 * The first step, in step order, that holds something invalid, or undefined
 * when everything is valid. Create sends the host there instead of sending.
 */
export function firstInvalidDraftStep(
  draft: WizardDraft,
): WizardStep | undefined {
  return stepOrder.find((step) => stepIsInvalid(draft, step));
}

/** The input for `createEvent`: the `create_event` request without its action. */
export function toCreateInput(
  draft: WizardDraft,
): Omit<CreateEventRequest, "action"> {
  const input: Omit<CreateEventRequest, "action"> = {
    niche: draft.niche,
    language: draft.language,
    enabledModules: draft.enabledModules,
    party: toParty(draft.party),
  };
  // Questions and categories only go with their activity switched on, and
  // only once there are some.
  if (draft.enabledModules.includes("quiz")) {
    const quiz = toQuizQuestions(draft.niche, draft.language, draft.quiz);
    if (quiz.length > 0) input.quiz = quiz;
  }
  if (draft.enabledModules.includes("awards")) {
    const awards = toAwardCategories(draft.niche, draft.language, draft.awards);
    if (awards.length > 0) input.awards = awards;
  }
  return input;
}

/** The full request body, in the shape the `create_event` schema checks. */
export function toCreateRequest(draft: WizardDraft): CreateEventRequest {
  return { action: "create_event", ...toCreateInput(draft) };
}
