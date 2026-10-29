import { describe, expect, it } from "vitest";
import { costsTotals, currentSharers, formatKr, shareOf } from "./shares";

const guests = new Set(["a", "b", "c"]);

describe("shareOf", () => {
  it("divides evenly when it can", () => {
    expect(shareOf(300, 3)).toBe(100);
  });

  it("rounds up to the next whole krona", () => {
    expect(shareOf(100, 3)).toBe(34);
    expect(shareOf(1, 3)).toBe(1);
  });
});

describe("currentSharers", () => {
  it("leaves out sharers who are no longer guests", () => {
    expect(currentSharers({ sharers: ["a", "gone", "b"] }, guests)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("costsTotals", () => {
  it("is zero without purchases", () => {
    expect(costsTotals([], guests)).toEqual({ spent: 0, owed: 0 });
  });

  it("owes a little more than spent when shares are rounded up", () => {
    const purchases = [
      { id: "1", name: "Pizza", price: 100, sharers: ["a", "b", "c"] },
    ];
    expect(costsTotals(purchases, guests)).toEqual({ spent: 100, owed: 102 });
  });

  it("recalculates when a sharer is removed", () => {
    const purchases = [
      { id: "1", name: "Pizza", price: 100, sharers: ["a", "b", "gone"] },
    ];
    expect(costsTotals(purchases, guests)).toEqual({ spent: 100, owed: 100 });
  });

  it("counts a purchase nobody still shares as spent but not owed", () => {
    const purchases = [
      { id: "1", name: "Wine", price: 200, sharers: ["gone"] },
    ];
    expect(costsTotals(purchases, guests)).toEqual({ spent: 200, owed: 0 });
  });
});

describe("formatKr", () => {
  it("writes whole kronor with kr", () => {
    expect(formatKr(120)).toBe("120 kr");
  });

  it("separates thousands with a no-break space", () => {
    expect(formatKr(12000)).toMatch(/^12\s000 kr$/);
  });
});
