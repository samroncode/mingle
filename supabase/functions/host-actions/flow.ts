// The event's flow as a state machine: the one place that decides which
// set_flow move is allowed in which state, and what state it leads to.
//
// | Move               | Allowed when                              | Leads to                          |
// |--------------------|-------------------------------------------|-----------------------------------|
// | start_module(m)    | not ended, no activity running, m enabled | live, m, step 0, idle             |
// | open               | an activity running, phase idle           | phase open                        |
// | reveal             | an activity running, phase open           | phase revealed                    |
// | next_step          | an activity running, phase idle/revealed  | step + 1, idle                    |
// | stop_module        | an activity running                       | live, no activity, step 0, idle   |
// | end_event          | not ended                                 | ended, no activity, step 0, idle  |
//
// Every other move answers `invalid_transition`; so does every move once the
// event has ended. start_module for an activity the host turned off answers
// `module_disabled`. An open step has to be revealed before next_step, so
// guests' answers are never dropped unseen. Stopping the activity returns the
// TV to the party screen (live with no activity). The `events_flow_check`
// constraint holds the same shape in the database.
import type {
  FlowMove,
  FlowState,
} from "../../../src/lib/schemas/host-actions.ts";

export type FlowTransition =
  | { ok: true; state: FlowState }
  | { ok: false; error: "invalid_transition" | "module_disabled" };

const idle = { currentStep: 0, phase: "idle" } as const;

export function applyMove(
  state: FlowState,
  enabledModules: readonly string[],
  move: FlowMove,
): FlowTransition {
  if (state.status === "ended") return refused();
  const running = state.currentModule !== null;

  switch (move.type) {
    case "start_module":
      if (running) return refused();
      if (!enabledModules.includes(move.module)) {
        return { ok: false, error: "module_disabled" };
      }
      return moved({ status: "live", currentModule: move.module, ...idle });
    case "open":
      if (!running || state.phase !== "idle") return refused();
      return moved({ ...state, phase: "open" });
    case "reveal":
      if (!running || state.phase !== "open") return refused();
      return moved({ ...state, phase: "revealed" });
    case "next_step":
      if (!running || state.phase === "open") return refused();
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
