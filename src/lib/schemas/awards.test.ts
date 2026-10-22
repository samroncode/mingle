import { describe, expect, it } from "vitest";
import {
  AwardCategoriesSchema,
  AwardCategorySchema,
  awardsLimits,
} from "./awards";

describe("AwardCategorySchema", () => {
  it("accepts text of 1 to 120 characters", () => {
    for (const text of ["x", "x".repeat(awardsLimits.text)]) {
      expect(AwardCategorySchema.safeParse({ text }).success).toBe(true);
    }
  });

  it("rejects empty, blank or too long text", () => {
    for (const text of ["", "   ", "x".repeat(awardsLimits.text + 1)]) {
      expect(AwardCategorySchema.safeParse({ text }).success).toBe(false);
    }
  });
});

describe("AwardCategoriesSchema", () => {
  it("accepts up to 20 categories and rejects 21", () => {
    const make = (n: number) =>
      Array.from({ length: n }, () => ({ text: "x" }));
    expect(AwardCategoriesSchema.safeParse(make(20)).success).toBe(true);
    expect(AwardCategoriesSchema.safeParse(make(21)).success).toBe(false);
  });
});
