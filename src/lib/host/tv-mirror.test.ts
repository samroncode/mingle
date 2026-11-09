import { describe, expect, it } from "vitest";
import { mirrorScale } from "./tv-mirror";

describe("mirrorScale", () => {
  it("fits the 1920 px TV into the box", () => {
    expect(mirrorScale(960)).toBe(0.5);
    expect(mirrorScale(320)).toBeCloseTo(1 / 6);
  });
  it("is zero before the box has a width", () => {
    expect(mirrorScale(0)).toBe(0);
  });
});
