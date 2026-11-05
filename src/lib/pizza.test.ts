import { describe, expect, it } from "vitest";
import { summarizeOrders } from "./pizza";

describe("summarizeOrders", () => {
  it("counts per pizza, ignoring case and spaces, most ordered first", () => {
    expect(
      summarizeOrders([
        { pizza: "Margherita", done: false },
        { pizza: " capricciosa ", done: false },
        { pizza: "Capricciosa", done: false },
      ]),
    ).toEqual([
      { pizza: "capricciosa", count: 2 },
      { pizza: "Margherita", count: 1 },
    ]);
  });

  it("leaves out orders that are already ordered", () => {
    expect(
      summarizeOrders([
        { pizza: "Margherita", done: true },
        { pizza: "Hawaii", done: false },
      ]),
    ).toEqual([{ pizza: "Hawaii", count: 1 }]);
  });

  it("is empty for no orders", () => {
    expect(summarizeOrders([])).toEqual([]);
  });
});
