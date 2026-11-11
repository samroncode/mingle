import { describe, expect, it } from "vitest";
import { nextProgramPoint } from "./next-program";

const lines = [
  { time: "18:00", title: "Welcome" },
  { title: "Mingle" },
  { time: "19:30", title: "Dinner" },
  { time: "21:00", title: "Quiz" },
];

describe("nextProgramPoint", () => {
  it("is the first timed line after the current one", () => {
    expect(nextProgramPoint(lines, 18 * 60 + 10)?.title).toBe("Dinner");
  });

  it("is the first line before anything has started", () => {
    expect(nextProgramPoint(lines, 17 * 60)?.title).toBe("Welcome");
  });

  it("does not count a line that starts this minute", () => {
    expect(nextProgramPoint(lines, 19 * 60 + 30)?.title).toBe("Quiz");
  });

  it("is undefined when everything has started", () => {
    expect(nextProgramPoint(lines, 22 * 60)).toBeUndefined();
  });

  it("is undefined with no times or no lines", () => {
    expect(nextProgramPoint([{ title: "Darts" }], 10)).toBeUndefined();
    expect(nextProgramPoint([], 10)).toBeUndefined();
  });

  it("ignores lines that are out of order", () => {
    const shuffled = [
      { time: "21:00", title: "Quiz" },
      { time: "19:30", title: "Dinner" },
    ];
    expect(nextProgramPoint(shuffled, 12 * 60)?.title).toBe("Dinner");
  });
});
