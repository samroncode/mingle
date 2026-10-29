import type { HotTakeProgress, HotTakeView } from "@/api/hottakes";
import type { EventRow, MemberRow } from "@/api/events";

type HotTakesFlow = Pick<EventRow, "current_module" | "current_step" | "phase">;

/** What the TV and the phone show while the hot takes run. */
export type HotTakesScreen =
  | { kind: "loading" }
  /** "Hot take 3 of 8, get ready" / "Next hot take coming". */
  | { kind: "idle"; number: number; total: number }
  /** The hot take is on screen: answers are open, or it was just revealed. */
  | {
      kind: "take";
      number: number;
      total: number;
      take: HotTakeView;
      revealed: boolean;
    }
  /** After the last hot take (step = number of hot takes). */
  | { kind: "summary" };

/**
 * Picks the hot takes screen from the event's flow, the hot takes' progress
 * and the hot takes the viewer can read. A hot take the viewer can't read yet
 * keeps the screen loading.
 */
export function hotTakesScreen(
  flow: HotTakesFlow,
  progress: HotTakeProgress | null,
  takes: HotTakeView[],
): HotTakesScreen {
  if (!progress) return { kind: "loading" };
  const step = flow.current_step;
  if (step >= progress.total) return { kind: "summary" };
  const counter = { number: step + 1, total: progress.total };
  if (flow.phase !== "open" && flow.phase !== "revealed") {
    return { kind: "idle", ...counter };
  }
  const take = takes.find((h) => h.position === step);
  if (!take) return { kind: "loading" };
  return {
    kind: "take",
    ...counter,
    take,
    revealed: flow.phase === "revealed",
  };
}

/** The control panel's one button: the move it makes and its label. */
export type HotTakesNextMove = {
  move: "open" | "reveal" | "next_step";
  labelKey:
    | "modules.hottakes.run.open"
    | "modules.hottakes.run.reveal"
    | "modules.hottakes.run.next"
    | "modules.hottakes.run.summary";
};

/**
 * What the one button does next while hot takes run, or null when it has
 * nothing to do (hot takes aren't running, or they are on the summary step).
 */
export function hotTakesNextMove(
  flow: HotTakesFlow,
  total: number,
): HotTakesNextMove | null {
  if (flow.current_module !== "hottakes" || flow.current_step >= total) {
    return null;
  }
  switch (flow.phase) {
    case "open":
      return { move: "reveal", labelKey: "modules.hottakes.run.reveal" };
    case "revealed":
      return {
        move: "next_step",
        labelKey:
          flow.current_step + 1 >= total
            ? "modules.hottakes.run.summary"
            : "modules.hottakes.run.next",
      };
    default:
      return { move: "open", labelKey: "modules.hottakes.run.open" };
  }
}

/** How many guests can answer: those who have a display name now. */
export function answeringGuests(
  members: Array<Pick<MemberRow, "role" | "display_name">>,
): number {
  return members.filter((m) => m.role === "guest" && m.display_name).length;
}
