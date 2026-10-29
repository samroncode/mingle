import type { AwardCategoryView, AwardProgress } from "@/api/awards";
import type { EventRow } from "@/api/events";

type AwardsFlow = Pick<EventRow, "current_module" | "current_step" | "phase">;

/** What the TV and the phone show while the awards run. */
export type AwardsScreen =
  | { kind: "loading" }
  /** "Award 3 of 8, get ready" / "Next award coming". */
  | { kind: "idle"; number: number; total: number }
  /** The category is on screen: voting is open, or it was just revealed. */
  | {
      kind: "category";
      number: number;
      total: number;
      category: AwardCategoryView;
      revealed: boolean;
    }
  /** After the last category (step = number of categories). */
  | { kind: "winners" };

/**
 * Picks the awards screen from the event's flow, the awards' progress and the
 * categories the viewer can read. A category the viewer can't read yet keeps
 * the screen loading.
 */
export function awardsScreen(
  flow: AwardsFlow,
  progress: AwardProgress | null,
  categories: AwardCategoryView[],
): AwardsScreen {
  if (!progress) return { kind: "loading" };
  const step = flow.current_step;
  if (step >= progress.total) return { kind: "winners" };
  const counter = { number: step + 1, total: progress.total };
  if (flow.phase !== "open" && flow.phase !== "revealed") {
    return { kind: "idle", ...counter };
  }
  const category = categories.find((c) => c.position === step);
  if (!category) return { kind: "loading" };
  return {
    kind: "category",
    ...counter,
    category,
    revealed: flow.phase === "revealed",
  };
}

/** The control panel's one button: the move it makes and its label. */
export type AwardsNextMove = {
  move: "open" | "reveal" | "next_step";
  labelKey:
    | "modules.awards.run.open"
    | "modules.awards.run.reveal"
    | "modules.awards.run.next"
    | "modules.awards.run.winners";
};

/**
 * What the one button does next while awards run, or null when it has nothing
 * to do (awards aren't running, or they are on the winners step).
 */
export function awardsNextMove(
  flow: AwardsFlow,
  total: number,
): AwardsNextMove | null {
  if (flow.current_module !== "awards" || flow.current_step >= total) {
    return null;
  }
  switch (flow.phase) {
    case "open":
      return { move: "reveal", labelKey: "modules.awards.run.reveal" };
    case "revealed":
      return {
        move: "next_step",
        labelKey:
          flow.current_step + 1 >= total
            ? "modules.awards.run.winners"
            : "modules.awards.run.next",
      };
    default:
      return { move: "open", labelKey: "modules.awards.run.open" };
  }
}
