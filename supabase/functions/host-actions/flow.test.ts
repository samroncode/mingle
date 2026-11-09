import { describe, expect, it } from "vitest";
import type {
  FlowMove,
  FlowState,
} from "../../../src/lib/schemas/host-actions.ts";
import { applyMove, type StepBounds } from "./flow.ts";

const all = ["quiz", "awards", "hottakes", "competitions"] as const;
const lobby: FlowState = {
  status: "lobby",
  currentModule: null,
  currentStep: 0,
  phase: "idle",
};
const startQuiz: FlowMove = { type: "start_module", module: "quiz" };

function quizAt(
  currentStep: number,
  phase: FlowState["phase"] = "idle",
): FlowState {
  return { status: "live", currentModule: "quiz", currentStep, phase };
}

function bounds(steps: number, firstUnplayed: number): StepBounds {
  return {
    steps,
    firstUnplayed,
    finished: steps > 0 && firstUnplayed >= steps,
  };
}

describe("applyMove without step bounds", () => {
  it("starts an activity on step 0 as before", () => {
    expect(applyMove(lobby, all, startQuiz)).toEqual({
      ok: true,
      state: quizAt(0),
    });
  });

  it("lets next_step go on without an end", () => {
    expect(applyMove(quizAt(41), all, { type: "next_step" })).toEqual({
      ok: true,
      state: quizAt(42),
    });
  });
});

describe("competitions (the spotlight)", () => {
  const start: FlowMove = { type: "start_module", module: "competitions" };
  const spot = (step: number): FlowState => ({
    status: "live",
    currentModule: "competitions",
    currentStep: step,
    phase: "idle",
  });
  const three: StepBounds = { steps: 3, firstUnplayed: 0, finished: false };

  it("starts on the first competition", () => {
    expect(applyMove(lobby, all, start, three)).toEqual({
      ok: true,
      state: spot(0),
    });
  });

  it("starts on the competition the host names", () => {
    expect(applyMove(lobby, all, { ...start, competition: 2 }, three)).toEqual({
      ok: true,
      state: spot(2),
    });
  });

  it("refuses a competition that doesn't exist", () => {
    expect(applyMove(lobby, all, { ...start, competition: 3 }, three)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("answers module_empty with no competitions", () => {
    expect(
      applyMove(lobby, all, start, {
        steps: 0,
        firstUnplayed: 0,
        finished: false,
      }),
    ).toEqual({ ok: false, error: "module_empty" });
  });

  it("answers module_disabled when the host turned it off", () => {
    expect(applyMove(lobby, ["quiz"], start, three)).toEqual({
      ok: false,
      error: "module_disabled",
    });
  });

  it("is refused while another activity runs", () => {
    expect(applyMove(quizAt(0), all, start, three)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("refuses starting another activity while the spotlight runs", () => {
    expect(applyMove(spot(0), all, startQuiz, bounds(5, 0))).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("refuses a competition for any other activity", () => {
    expect(
      applyMove(lobby, all, { ...startQuiz, competition: 0 }, bounds(5, 0)),
    ).toEqual({ ok: false, error: "invalid_transition" });
  });

  it.each<FlowMove>([
    { type: "open" },
    { type: "reveal" },
    { type: "next_step" },
  ])("has no $type", (move) => {
    expect(applyMove(spot(0), all, move, three)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("stops back to the party screen", () => {
    expect(applyMove(spot(1), all, { type: "stop_module" }, three)).toEqual({
      ok: true,
      state: { ...lobby, status: "live" },
    });
  });
});

describe("applyMove with step bounds", () => {
  it("starts at the first unplayed step", () => {
    expect(applyMove(lobby, all, startQuiz, bounds(10, 3))).toEqual({
      ok: true,
      state: quizAt(3),
    });
  });

  it("refuses to start an activity without steps with module_empty", () => {
    expect(applyMove(lobby, all, startQuiz, bounds(0, 0))).toEqual({
      ok: false,
      error: "module_empty",
    });
  });

  it("refuses to start a finished activity with module_finished", () => {
    expect(applyMove(lobby, all, startQuiz, bounds(5, 5))).toEqual({
      ok: false,
      error: "module_finished",
    });
  });

  it("checks that the activity is enabled before its steps", () => {
    expect(applyMove(lobby, ["awards"], startQuiz, bounds(0, 0))).toEqual({
      ok: false,
      error: "module_disabled",
    });
  });

  it("refuses to start while another activity runs, whatever the bounds", () => {
    const running: FlowState = { ...quizAt(0), currentModule: "awards" };
    expect(applyMove(running, all, startQuiz, bounds(5, 5))).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("moves from the last step to the results step", () => {
    expect(
      applyMove(
        quizAt(4, "revealed"),
        all,
        { type: "next_step" },
        bounds(5, 5),
      ),
    ).toEqual({ ok: true, state: quizAt(5) });
  });

  it.each<FlowMove>([
    { type: "open" },
    { type: "reveal" },
    { type: "next_step" },
  ])("refuses $type on the results step", (move) => {
    expect(applyMove(quizAt(5), all, move, bounds(5, 5))).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });

  it("refuses reveal on the results step even if the phase says open", () => {
    expect(
      applyMove(quizAt(5, "open"), all, { type: "reveal" }, bounds(5, 5)),
    ).toEqual({ ok: false, error: "invalid_transition" });
  });

  it("stops from the results step", () => {
    expect(
      applyMove(quizAt(5), all, { type: "stop_module" }, bounds(5, 5)),
    ).toEqual({
      ok: true,
      state: { ...lobby, status: "live" },
    });
  });

  it("opens and reveals a question before the results step", () => {
    expect(applyMove(quizAt(4), all, { type: "open" }, bounds(5, 4))).toEqual({
      ok: true,
      state: quizAt(4, "open"),
    });
    expect(
      applyMove(quizAt(4, "open"), all, { type: "reveal" }, bounds(5, 4)),
    ).toEqual({ ok: true, state: quizAt(4, "revealed") });
  });

  it("still refuses every move after the event ended", () => {
    const ended: FlowState = { ...lobby, status: "ended" };
    expect(applyMove(ended, all, startQuiz, bounds(5, 0))).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});
