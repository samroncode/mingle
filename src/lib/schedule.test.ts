import { describe, expect, it } from "vitest";
import { anyLineHasTime, formatScheduleLine } from "@/lib/schedule";

describe("formatScheduleLine", () => {
  it("joins time and title with one space", () => {
    expect(formatScheduleLine({ time: "19:00", title: "Dinner" })).toBe(
      "19:00 Dinner",
    );
  });

  it("shows only the title when there is no time", () => {
    expect(formatScheduleLine({ title: "Darts" })).toBe("Darts");
    expect(formatScheduleLine({ time: "", title: "Darts" })).toBe("Darts");
  });
});

describe("anyLineHasTime", () => {
  it("is true for mixed and all-timed lists", () => {
    expect(
      anyLineHasTime([{ title: "Darts" }, { time: "19:00", title: "Dinner" }]),
    ).toBe(true);
  });

  it("is false when no line has a time, or the list is empty", () => {
    expect(anyLineHasTime([{ title: "Darts" }, { title: "Pong" }])).toBe(false);
    expect(anyLineHasTime([])).toBe(false);
  });
});
