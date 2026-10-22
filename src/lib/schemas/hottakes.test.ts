import { describe, expect, it } from "vitest";
import { HotTakesSchema, HotTakeSchema, hottakesLimits } from "./hottakes";

describe("HotTakeSchema", () => {
  it("accepts text of 1 to 120 characters", () => {
    for (const text of ["x", "x".repeat(hottakesLimits.text)]) {
      expect(HotTakeSchema.safeParse({ text }).success).toBe(true);
    }
  });

  it("rejects empty, blank or too long text", () => {
    for (const text of ["", "   ", "x".repeat(hottakesLimits.text + 1)]) {
      expect(HotTakeSchema.safeParse({ text }).success).toBe(false);
    }
  });
});

describe("HotTakesSchema", () => {
  it("accepts up to 20 hot takes and rejects 21", () => {
    const make = (n: number) =>
      Array.from({ length: n }, () => ({ text: "x" }));
    expect(HotTakesSchema.safeParse(make(20)).success).toBe(true);
    expect(HotTakesSchema.safeParse(make(21)).success).toBe(false);
  });
});
