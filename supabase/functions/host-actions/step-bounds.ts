// Step bounds per activity (see flow.ts): one small function per activity
// with a fixed list of steps. An activity without one has no bounds and
// behaves as before. Add an activity by adding its reader to `readers`.
import type { ModuleId } from "../../../src/modules/registry.ts";
import type { Db } from "./db.ts";
import type { StepBounds } from "./flow.ts";

/** The bounds, or "error" if they can't be read. */
type BoundsResult = StepBounds | "error";
type BoundsReader = (db: Db, eventId: string) => Promise<BoundsResult>;

/**
 * The quiz: a step is a question by position. A question is played once it
 * has been revealed, which the database records with the reveal itself. Only
 * approved questions count, the same ones guests and the TV can see.
 */
async function quizBounds(db: Db, eventId: string): Promise<BoundsResult> {
  const { data, error } = await db
    .from("quiz_questions")
    .select("position, revealed_at")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("position");
  if (error) {
    console.error("reading the quiz bounds failed", error.code);
    return "error";
  }
  const unplayed = data.find((question) => question.revealed_at === null);
  return {
    steps: data.length,
    firstUnplayed: unplayed?.position ?? data.length,
    finished: data.length > 0 && unplayed === undefined,
  };
}

/**
 * Awards: a step is a category by position. A category is revealed once its
 * winner has been shown, which the database records with the reveal itself.
 * Only approved categories count, the same ones guests and the TV can see.
 */
async function awardsBounds(db: Db, eventId: string): Promise<BoundsResult> {
  const { data, error } = await db
    .from("award_categories")
    .select("position, revealed_at")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("position");
  if (error) {
    console.error("reading the awards bounds failed", error.code);
    return "error";
  }
  const unrevealed = data.find((category) => category.revealed_at === null);
  return {
    steps: data.length,
    firstUnplayed: unrevealed?.position ?? data.length,
    finished: data.length > 0 && unrevealed === undefined,
  };
}

const readers: Partial<Record<ModuleId, BoundsReader>> = {
  quiz: quizBounds,
  awards: awardsBounds,
};

/** The step bounds of `module` in the event; null for an activity without. */
export function readStepBounds(
  db: Db,
  eventId: string,
  module: ModuleId | null,
): Promise<BoundsResult | null> {
  const reader = module === null ? undefined : readers[module];
  return reader ? reader(db, eventId) : Promise.resolve(null);
}
