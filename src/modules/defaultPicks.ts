import type { HostActionError } from "@/api/host-actions";
import { updateAwards, updateHotTakes, updateQuiz } from "@/api/host-actions";
import { getAwardProgress } from "@/api/awards";
import { getHotTakeProgress } from "@/api/hottakes";
import { getQuizProgress } from "@/api/quiz";
import type { Language } from "@/i18n/language";
import { saveAwardsEdit } from "@/lib/host/awards-edit";
import { saveHotTakesEdit } from "@/lib/host/hottakes-edit";
import { saveQuizEdit } from "@/lib/host/quiz-edit";
import {
  awardsReducer,
  emptyAwards,
  pickDefaultAwardIds,
} from "@/lib/wizard/awards";
import {
  emptyHotTakes,
  hotTakesReducer,
  pickDefaultHotTakeIds,
} from "@/lib/wizard/hottakes";
import { emptyQuiz, pickDefaultQuizIds, quizReducer } from "@/lib/wizard/quiz";
import type { NicheId } from "@/niches";
import type { ModuleId } from "./registry";

/** The event an activity's default pick is saved to. */
export interface DefaultPickTarget {
  eventId: string;
  code: string;
  key: string;
  niche: NicheId;
  language: Language;
}

/** `picked` is false when the activity already had items and was left alone. */
export type DefaultPickResult =
  { ok: true; picked: boolean } | { ok: false; error?: HostActionError };

type DefaultPick = (
  target: DefaultPickTarget,
  random?: () => number,
) => Promise<DefaultPickResult>;

const failed: DefaultPickResult = { ok: false };

/** Saves nothing for an activity that has items; a finished one can't change. */
async function pickWhenEmpty(
  total: Promise<number | undefined>,
  save: () => Promise<DefaultPickResult>,
): Promise<DefaultPickResult> {
  const count = await total;
  if (count === undefined) return failed;
  return count > 0 ? { ok: true, picked: false } : save();
}

function savedAs(
  result:
    | { ok: true }
    | { ok: false; invalid: string[] }
    | { ok: false; error: HostActionError },
): DefaultPickResult {
  if (result.ok) return { ok: true, picked: true };
  return "error" in result ? { ok: false, error: result.error } : failed;
}

/**
 * Each activity's wizard pick, saved with its own update action, so a freshly
 * switched-on activity is ready to start. Keyed by activity: a new activity
 * can't be added to the registry without one.
 */
export const defaultPicks: Record<ModuleId, DefaultPick> = {
  quiz: (target, random) =>
    pickWhenEmpty(
      getQuizProgress(target.eventId).then((r) =>
        r.ok ? r.value.total : undefined,
      ),
      async () =>
        savedAs(
          await saveQuizEdit(
            target.niche,
            target.language,
            quizReducer(emptyQuiz, {
              type: "seed",
              ids: pickDefaultQuizIds(target.niche, random),
            }),
            target,
            updateQuiz,
          ),
        ),
    ),
  awards: (target, random) =>
    pickWhenEmpty(
      getAwardProgress(target.eventId).then((r) =>
        r.ok ? r.value.total : undefined,
      ),
      async () =>
        savedAs(
          await saveAwardsEdit(
            target.niche,
            target.language,
            awardsReducer(emptyAwards, {
              type: "seed",
              ids: pickDefaultAwardIds(target.niche, random),
            }),
            target,
            updateAwards,
          ),
        ),
    ),
  hottakes: (target, random) =>
    pickWhenEmpty(
      getHotTakeProgress(target.eventId).then((r) =>
        r.ok ? r.value.total : undefined,
      ),
      async () =>
        savedAs(
          await saveHotTakesEdit(
            target.niche,
            target.language,
            hotTakesReducer(emptyHotTakes, {
              type: "seed",
              ids: pickDefaultHotTakeIds(target.niche, random),
            }),
            target,
            updateHotTakes,
          ),
        ),
    ),
};
