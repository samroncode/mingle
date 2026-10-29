import { describe, expect, it } from "vitest";
import type { HotTakeView } from "@/api/hottakes";
import { answeringGuests, hotTakesNextMove, hotTakesScreen } from "./screen";

const take: HotTakeView = {
  id: "c3",
  position: 2,
  text: "Pineapple belongs on pizza",
  answerCount: 0,
  revealed: false,
};
const progress = { total: 8, revealed: 2 };

function flow(
  current_step: number,
  phase: string,
  current_module = "hottakes",
) {
  return { current_module, current_step, phase };
}

describe("hotTakesScreen", () => {
  it("waits while the progress is unknown", () => {
    expect(hotTakesScreen(flow(2, "idle"), null, [])).toEqual({
      kind: "loading",
    });
  });

  it("says which hot take comes next while the step is idle", () => {
    expect(hotTakesScreen(flow(2, "idle"), progress, [])).toEqual({
      kind: "idle",
      number: 3,
      total: 8,
    });
  });

  it("shows the take once voting is open", () => {
    expect(hotTakesScreen(flow(2, "open"), progress, [take])).toEqual({
      kind: "take",
      number: 3,
      total: 8,
      take,
      revealed: false,
    });
  });

  it("keeps showing the take once revealed", () => {
    expect(hotTakesScreen(flow(2, "revealed"), progress, [take])).toEqual({
      kind: "take",
      number: 3,
      total: 8,
      take,
      revealed: true,
    });
  });

  it("waits for an open take it hasn't read yet", () => {
    const earlier = { ...take, position: 1 };
    expect(hotTakesScreen(flow(2, "open"), progress, [earlier])).toEqual({
      kind: "loading",
    });
  });

  it("shows the summary step after the last take", () => {
    expect(hotTakesScreen(flow(8, "idle"), progress, [take])).toEqual({
      kind: "summary",
    });
  });
});

describe("hotTakesNextMove", () => {
  it("opens an idle take", () => {
    expect(hotTakesNextMove(flow(0, "idle"), 8)).toEqual({
      move: "open",
      labelKey: "modules.hottakes.run.open",
    });
  });

  it("reveals an open take", () => {
    expect(hotTakesNextMove(flow(0, "open"), 8)).toEqual({
      move: "reveal",
      labelKey: "modules.hottakes.run.reveal",
    });
  });

  it("moves on after a reveal", () => {
    expect(hotTakesNextMove(flow(3, "revealed"), 8)).toEqual({
      move: "next_step",
      labelKey: "modules.hottakes.run.next",
    });
  });

  it("offers all summary after the last take", () => {
    expect(hotTakesNextMove(flow(7, "revealed"), 8)).toEqual({
      move: "next_step",
      labelKey: "modules.hottakes.run.summary",
    });
  });

  it("has nothing to do on the summary step or when hottakes aren't running", () => {
    expect(hotTakesNextMove(flow(8, "idle"), 8)).toBeNull();
    expect(hotTakesNextMove(flow(0, "idle", "quiz"), 8)).toBeNull();
  });
});

describe("answeringGuests", () => {
  it("counts guests with a display name, not the host, the TV or unnamed guests", () => {
    expect(
      answeringGuests([
        { role: "host", display_name: null },
        { role: "tv", display_name: null },
        { role: "guest", display_name: "Anna" },
        { role: "guest", display_name: "Bertil" },
        { role: "guest", display_name: null },
      ]),
    ).toBe(2);
  });
});
