import { AwardsGuest } from "./awards/guest/AwardsGuest";
import { AwardsHost } from "./awards/host/AwardsHost";
import { AwardsLive } from "./awards/host/AwardsLive";
import { AwardsTv } from "./awards/tv/AwardsTv";
import { useAwardsProgressText } from "./awards/useAwardsProgressText";
import { useAwardsCounts, useAwardsSummary } from "./awards/useAwardsSummary";
import { AwardsStep } from "./awards/wizard/AwardsStep";
import { CompetitionsGuest } from "./competitions/guest/CompetitionsGuest";
import { CompetitionsHost } from "./competitions/host/CompetitionsHost";
import { CompetitionsLive } from "./competitions/host/CompetitionsLive";
import { CompetitionsTv } from "./competitions/tv/CompetitionsTv";
import { useCompetitionsSummary } from "./competitions/useCompetitionsSummary";
import { CompetitionsStep } from "./competitions/wizard/CompetitionsStep";
import { HotTakesGuest } from "./hottakes/guest/HotTakesGuest";
import { HotTakesHost } from "./hottakes/host/HotTakesHost";
import { HotTakesLive } from "./hottakes/host/HotTakesLive";
import { HotTakesTv } from "./hottakes/tv/HotTakesTv";
import { useHotTakesProgressText } from "./hottakes/useHotTakesProgressText";
import {
  useHotTakesCounts,
  useHotTakesSummary,
} from "./hottakes/useHotTakesSummary";
import { HotTakesStep } from "./hottakes/wizard/HotTakesStep";
import { QuizGuest } from "./quiz/guest/QuizGuest";
import { QuizHost } from "./quiz/host/QuizHost";
import { QuizLive } from "./quiz/host/QuizLive";
import { QuizTv } from "./quiz/tv/QuizTv";
import { useQuizProgressText } from "./quiz/useQuizProgressText";
import { useQuizCounts, useQuizSummary } from "./quiz/useQuizSummary";
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
    Live: QuizLive,
    useProgress: useQuizProgressText,
    useSummary: useQuizSummary,
    useCounts: useQuizCounts,
    WizardStep: QuizStep,
  },
  awards: {
    id: "awards",
    nameKey: "modules.awards.name",
    Tv: AwardsTv,
    Guest: AwardsGuest,
    Host: AwardsHost,
    Live: AwardsLive,
    useProgress: useAwardsProgressText,
    useSummary: useAwardsSummary,
    useCounts: useAwardsCounts,
    WizardStep: AwardsStep,
  },
  hottakes: {
    id: "hottakes",
    nameKey: "modules.hottakes.name",
    Tv: HotTakesTv,
    Guest: HotTakesGuest,
    Host: HotTakesHost,
    Live: HotTakesLive,
    useProgress: useHotTakesProgressText,
    useSummary: useHotTakesSummary,
    useCounts: useHotTakesCounts,
    WizardStep: HotTakesStep,
  },
  competitions: {
    id: "competitions",
    nameKey: "modules.competitions.name",
    Tv: CompetitionsTv,
    Guest: CompetitionsGuest,
    Host: CompetitionsHost,
    Live: CompetitionsLive,
    useSummary: useCompetitionsSummary,
    WizardStep: CompetitionsStep,
  },
};
