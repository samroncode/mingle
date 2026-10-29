import { describe, expect, it } from "vitest";
import type { AwardCategoryView } from "@/api/awards";
import { awardsNextMove, awardsScreen } from "./screen";

const category: AwardCategoryView = {
  id: "c3",
  position: 2,
  text: "Most likely to dance on a table",
  voteCount: 0,
  revealed: false,
};
const progress = { total: 8, revealed: 2 };

function flow(current_step: number, phase: string, current_module = "awards") {
  return { current_module, current_step, phase };
}

describe("awardsScreen", () => {
  it("waits while the progress is unknown", () => {
    expect(awardsScreen(flow(2, "idle"), null, [])).toEqual({
      kind: "loading",
    });
  });

  it("says which award comes next while the step is idle", () => {
    expect(awardsScreen(flow(2, "idle"), progress, [])).toEqual({
      kind: "idle",
      number: 3,
      total: 8,
    });
  });

  it("shows the category once voting is open", () => {
    expect(awardsScreen(flow(2, "open"), progress, [category])).toEqual({
      kind: "category",
      number: 3,
      total: 8,
      category,
      revealed: false,
    });
  });

  it("keeps showing the category once revealed", () => {
    expect(awardsScreen(flow(2, "revealed"), progress, [category])).toEqual({
      kind: "category",
      number: 3,
      total: 8,
      category,
      revealed: true,
    });
  });

  it("waits for an open category it hasn't read yet", () => {
    const earlier = { ...category, position: 1 };
    expect(awardsScreen(flow(2, "open"), progress, [earlier])).toEqual({
      kind: "loading",
    });
  });

  it("shows the winners step after the last category", () => {
    expect(awardsScreen(flow(8, "idle"), progress, [category])).toEqual({
      kind: "winners",
    });
  });
});

describe("awardsNextMove", () => {
  it("opens an idle category", () => {
    expect(awardsNextMove(flow(0, "idle"), 8)).toEqual({
      move: "open",
      labelKey: "modules.awards.run.open",
    });
  });

  it("reveals an open category", () => {
    expect(awardsNextMove(flow(0, "open"), 8)).toEqual({
      move: "reveal",
      labelKey: "modules.awards.run.reveal",
    });
  });

  it("moves on after a reveal", () => {
    expect(awardsNextMove(flow(3, "revealed"), 8)).toEqual({
      move: "next_step",
      labelKey: "modules.awards.run.next",
    });
  });

  it("offers all winners after the last category", () => {
    expect(awardsNextMove(flow(7, "revealed"), 8)).toEqual({
      move: "next_step",
      labelKey: "modules.awards.run.winners",
    });
  });

  it("has nothing to do on the winners step or when awards aren't running", () => {
    expect(awardsNextMove(flow(8, "idle"), 8)).toBeNull();
    expect(awardsNextMove(flow(0, "idle", "quiz"), 8)).toBeNull();
  });
});
