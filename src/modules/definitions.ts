import { AwardsGuest } from "./awards/guest/AwardsGuest";
import { AwardsHost } from "./awards/host/AwardsHost";
import { AwardsTv } from "./awards/tv/AwardsTv";
import { useAwardsProgressText } from "./awards/useAwardsProgressText";
import { useAwardsSummary } from "./awards/useAwardsSummary";
import { AwardsStep } from "./awards/wizard/AwardsStep";
import { HotTakesGuest } from "./hottakes/guest/HotTakesGuest";
import { HotTakesHost } from "./hottakes/host/HotTakesHost";
import { HotTakesTv } from "./hottakes/tv/HotTakesTv";
import { useHotTakesProgressText } from "./hottakes/useHotTakesProgressText";
import { useHotTakesSummary } from "./hottakes/useHotTakesSummary";
import { HotTakesStep } from "./hottakes/wizard/HotTakesStep";
import { QuizGuest } from "./quiz/guest/QuizGuest";
import { QuizHost } from "./quiz/host/QuizHost";
import { QuizTv } from "./quiz/tv/QuizTv";
import { useQuizProgressText } from "./quiz/useQuizProgressText";
import { useQuizSummary } from "./quiz/useQuizSummary";
import { QuizStep } from "./quiz/wizard/QuizStep";
import type { ModuleDefinition } from "./types";
import type { ModuleId } from "./registry";

/**
 * The activities that have views. Kept apart from `registry.ts`, whose id list
 * is also imported by the Edge Function and so can't pull in React. An
 * activity without an entry keeps the party screen and the evening's info.
 */
export const moduleDefinitions: Partial<Record<ModuleId, ModuleDefinition>> = {
  quiz: {
    id: "quiz",
    nameKey: "modules.quiz.name",
    Tv: QuizTv,
    Guest: QuizGuest,
    Host: QuizHost,
    useProgress: useQuizProgressText,
    useSummary: useQuizSummary,
    WizardStep: QuizStep,
  },
  awards: {
    id: "awards",
    nameKey: "modules.awards.name",
    Tv: AwardsTv,
    Guest: AwardsGuest,
    Host: AwardsHost,
    useProgress: useAwardsProgressText,
    useSummary: useAwardsSummary,
    WizardStep: AwardsStep,
  },
  hottakes: {
    id: "hottakes",
    nameKey: "modules.hottakes.name",
    Tv: HotTakesTv,
    Guest: HotTakesGuest,
    Host: HotTakesHost,
    useProgress: useHotTakesProgressText,
    useSummary: useHotTakesSummary,
    WizardStep: HotTakesStep,
  },
};
