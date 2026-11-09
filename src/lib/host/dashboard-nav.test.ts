import { describe, expect, it } from "vitest";
import { currentProgramIndex, navCounts, sectionInView } from "./dashboard-nav";

describe("navCounts", () => {
  it("counts activities, program lines and guests only", () => {
    expect(navCounts({ activities: 3, program: 0, guests: 12 })).toEqual({
      activities: 3,
      program: 0,
      guests: 12,
    });
  });
});

describe("sectionInView", () => {
  const tops = [
    { id: "live", top: -400 },
    { id: "activities", top: -20 },
    { id: "program", top: 300 },
    { id: "guests", top: 900 },
  ];

  it("picks the last section that has passed the line", () => {
    expect(sectionInView(tops, 100)).toBe("activities");
  });

  it("does not depend on the order of the list", () => {
    expect(sectionInView([...tops].reverse(), 100)).toBe("activities");
  });

  it("picks the topmost when nothing has passed the line", () => {
    expect(
      sectionInView(
        [
          { id: "live", top: 200 },
          { id: "program", top: 600 },
        ],
        100,
      ),
    ).toBe("live");
  });

  it("has no answer without sections", () => {
    expect(sectionInView([], 100)).toBeUndefined();
  });
});

describe("currentProgramIndex", () => {
  const lines = [
    { time: "18:00", title: "Welcome" },
    { title: "Mingle" },
    { time: "19:30", title: "Dinner" },
    { time: "21:00", title: "Quiz" },
  ];

  it("is the last timed line that has started", () => {
    expect(currentProgramIndex(lines, 19 * 60 + 45)).toBe(2);
  });

  it("is -1 before the first line starts", () => {
    expect(currentProgramIndex(lines, 17 * 60)).toBe(-1);
  });

  it("is -1 when no line has a time", () => {
    expect(currentProgramIndex([{}, {}], 20 * 60)).toBe(-1);
  });

  it("ignores values that are not times", () => {
    expect(
      currentProgramIndex([{ time: "soon" }, { time: "25:00" }], 600),
    ).toBe(-1);
  });
});
