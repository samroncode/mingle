import { describe, expect, it } from "vitest";
import { idsSignal, isBillUpdated } from "./bill";

describe("idsSignal", () => {
  it("ignores order and changes with the ids", () => {
    expect(idsSignal(["a", "b"])).toBe(idsSignal(["b", "a"]));
    expect(idsSignal(["a", "b"])).not.toBe(idsSignal(["a", "c"]));
    expect(idsSignal(["a", "b"])).not.toBe(idsSignal(["a"]));
  });
});

describe("isBillUpdated", () => {
  it("is false until a total has been seen", () => {
    expect(isBillUpdated(null, 100)).toBe(false);
    expect(isBillUpdated(null, null)).toBe(false);
  });

  it("is true only when the total differs from the one seen", () => {
    expect(isBillUpdated(100, 100)).toBe(false);
    expect(isBillUpdated(100, 150)).toBe(true);
    expect(isBillUpdated(100, null)).toBe(false);
  });
});
