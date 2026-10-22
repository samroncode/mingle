// The event's flow as a state machine: the one place that decides which
// set_flow move is allowed in which state, and what state it leads to.
//
// | Move            | Allowed when                              | Leads to                              |
// |-----------------|-------------------------------------------|---------------------------------------|
// | start_module(m) | not ended, no activity running, m enabled | live, m, first unplayed step*, idle   |
// | open            | an activity running on a step*, idle      | phase open                            |
// | reveal          | an activity running on a step*, open      | phase revealed                        |
// | next_step       | an activity running on a step*, idle or   | step + 1, idle                        |
// |                 | revealed                                  |                                       |
// | stop_module     | an activity running                       | live, no activity, step 0, idle       |
// | end_event       | not ended                                 | ended, no activity, step 0, idle      |
//
// Every other move answers `invalid_transition`; so does every move once the
// event has ended. start_module for an activity the host turned off answers
// `module_disabled`. An open step has to be revealed before next_step, so
// guests' answers are never dropped unseen. Stopping the activity returns the
// TV to the party screen (live with no activity). The `events_flow_check`
// constraint holds the same shape in the database.
//
// * Step bounds. An activity with a fixed list of steps (the quiz: one per
//   question) gives its StepBounds (step-bounds.ts). It starts at its first
//   unplayed step; with no steps start_module answers `module_empty`, with
//   every step played `module_finished`. next_step from the last step moves
//   to the results step (step = number of steps), which is not "on a step":
//   there open, reveal and next_step answer `invalid_transition`, and only
//   stop_module or end_event leave it. An activity without bounds starts at
//   step 0 and its steps never end.
import type {
  FlowMove,
  FlowState,
} from "../../../src/lib/schemas/host-actions.ts";
import type { ModuleId } from "../../../src/modules/registry.ts";

/** Where an activity with a fixed list of steps stands. */
export type StepBounds = {
  /** How many steps it has; the step after the last is its results step. */
  steps: number;
  /** The step it starts at: its first step not played yet. */
  firstUnplayed: number;
  /** Every step has been played, so it can't be started again. */
  finished: boolean;
};

export type FlowTransition =
  | { ok: true; state: FlowState }
  | {
      ok: false;
      error:
        | "invalid_transition"
        | "module_disabled"
        | "module_empty"
        | "module_finished";
    };

const idle = { currentStep: 0, phase: "idle" } as const;

/**
 * The state `move` leads to from `state`. `bounds` are the step bounds of the
 * activity the move is about (the one start_module names, else the running
 * one), or null for an activity without them.
 */
export function applyMove(
  state: FlowState,
  enabledModules: readonly ModuleId[],
  move: FlowMove,
  bounds: StepBounds | null = null,
): FlowTransition {
  if (state.status === "ended") return refused();
  const running = state.currentModule !== null;
  const onStep = running && (!bounds || state.currentStep < bounds.steps);

  switch (move.type) {
    case "start_module":
      if (running) return refused();
      if (!enabledModules.includes(move.module)) {
        return { ok: false, error: "module_disabled" };
      }
      if (bounds?.steps === 0) return { ok: false, error: "module_empty" };
      if (bounds?.finished) return { ok: false, error: "module_finished" };
      return moved({
        status: "live",
        currentModule: move.module,
        currentStep: bounds?.firstUnplayed ?? 0,
        phase: "idle",
      });
    case "open":
      if (!onStep || state.phase !== "idle") return refused();
      return moved({ ...state, phase: "open" });
    case "reveal":
      if (!onStep || state.phase !== "open") return refused();
      return moved({ ...state, phase: "revealed" });
    case "next_step":
      if (!onStep || state.phase === "open") return refused();
      return moved({
        ...state,
        currentStep: state.currentStep + 1,
        phase: "idle",
      });
    case "stop_module":
      if (!running) return refused();
      return moved({ status: "live", currentModule: null, ...idle });
    case "end_event":
      return moved({ status: "ended", currentModule: null, ...idle });
  }
}

function moved(state: FlowState): FlowTransition {
  return { ok: true, state };
}

function refused(): FlowTransition {
  return { ok: false, error: "invalid_transition" };
}
