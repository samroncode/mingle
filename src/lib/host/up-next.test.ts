import { describe, expect, it } from "vitest";
import { upNext } from "./up-next";

describe("upNext", () => {
  it("picks the first activity in the event's order that has items left", () => {
    expect(
      upNext(["awards", "quiz"], {
        quiz: { total: 5, done: 0 },
        awards: { total: 3, done: 1 },
      }),
    ).toBe("awards");
  });

  it("skips activities whose items are all played", () => {
    expect(
      upNext(["quiz", "awards"], {
        quiz: { total: 5, done: 5 },
        awards: { total: 3, done: 0 },
      }),
    ).toBe("awards");
  });

  it("never picks an activity without counts or without items", () => {
    expect(
      upNext(["competitions", "wheel", "hottakes", "quiz"], {
        hottakes: { total: 0, done: 0 },
        quiz: undefined,
      }),
    ).toBeNull();
  });

  it("returns null when nothing is enabled or everything is played", () => {
    expect(upNext([], { quiz: { total: 5, done: 0 } })).toBeNull();
    expect(upNext(["quiz"], { quiz: { total: 5, done: 5 } })).toBeNull();
  });
});
