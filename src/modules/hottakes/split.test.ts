import { describe, expect, it } from "vitest";
import { guestStanding, splitView } from "./split";

describe("splitView", () => {
  it("is none when nobody answered", () => {
    expect(splitView({ agree: 0, disagree: 0 })).toEqual({ kind: "none" });
  });

  it("is even for an exact 50/50", () => {
    expect(splitView({ agree: 3, disagree: 3 })).toEqual({
      kind: "even",
      agreePercent: 50,
      disagreePercent: 50,
    });
  });

  it("names the side with the majority", () => {
    expect(splitView({ agree: 3, disagree: 1 })).toMatchObject({
      kind: "agree",
      agreePercent: 75,
      disagreePercent: 25,
    });
    expect(splitView({ agree: 1, disagree: 4 })).toMatchObject({
      kind: "disagree",
      agreePercent: 20,
      disagreePercent: 80,
    });
  });

  it("rounds to whole numbers that add up to 100", () => {
    expect(splitView({ agree: 1, disagree: 2 })).toMatchObject({
      agreePercent: 33,
      disagreePercent: 67,
    });
    expect(splitView({ agree: 1, disagree: 7 })).toMatchObject({
      agreePercent: 13,
      disagreePercent: 87,
    });
    expect(splitView({ agree: 199, disagree: 1 })).toMatchObject({
      agreePercent: 100,
      disagreePercent: 0,
    });
  });

  it("keeps a lopsided room from reading as even", () => {
    expect(splitView({ agree: 201, disagree: 199 })).toMatchObject({
      kind: "agree",
      agreePercent: 50,
      disagreePercent: 50,
    });
  });
});

describe("guestStanding", () => {
  it("is with the majority or in the minority", () => {
    expect(guestStanding(true, { agree: 3, disagree: 1 })).toBe("majority");
    expect(guestStanding(false, { agree: 3, disagree: 1 })).toBe("minority");
    expect(guestStanding(false, { agree: 1, disagree: 3 })).toBe("majority");
    expect(guestStanding(true, { agree: 1, disagree: 3 })).toBe("minority");
  });

  it("is even in an evenly split room", () => {
    expect(guestStanding(true, { agree: 2, disagree: 2 })).toBe("even");
    expect(guestStanding(false, { agree: 2, disagree: 2 })).toBe("even");
  });

  it("is nothing without an answer", () => {
    expect(guestStanding(null, { agree: 3, disagree: 1 })).toBeNull();
    expect(guestStanding(null, { agree: 0, disagree: 0 })).toBeNull();
  });
});
