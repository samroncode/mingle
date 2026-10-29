import { describe, expect, it } from "vitest";
import { CostsSchema, normalizeSwishNumber } from "./costs";

const guest = "7f9c3c9e-52a1-4a52-9d0e-1c8f6a7b2d11";
const valid = {
  payeeName: "Sam",
  swishNumber: "070-123 45 67",
  purchases: [{ name: "Drinks", price: 450, sharers: [guest] }],
};

describe("normalizeSwishNumber", () => {
  it.each([
    "070-123 45 67",
    "0701234567",
    "+46 70 123 45 67",
    "+46701234567",
    "0046701234567",
    "46701234567",
    "(070) 123 45 67",
  ])("normalises %s", (input) => {
    expect(normalizeSwishNumber(input)).toBe("46701234567");
  });

  it.each([
    "",
    "123",
    "070123456",
    "07012345678",
    "0801234567",
    "081234567",
    "701234567",
    "+47701234567",
    "070 abc 45 67",
  ])("rejects %j", (input) => {
    expect(normalizeSwishNumber(input)).toBeNull();
  });

  it("accepts the other Swedish mobile prefixes", () => {
    for (const prefix of ["72", "73", "76", "79"]) {
      expect(normalizeSwishNumber(`0${prefix}1234567`)).toBe(
        `46${prefix}1234567`,
      );
    }
  });
});

describe("CostsSchema", () => {
  it("accepts valid costs and stores the number normalised", () => {
    const parsed = CostsSchema.parse(valid);
    expect(parsed.swishNumber).toBe("46701234567");
  });

  it("accepts no purchases", () => {
    expect(CostsSchema.safeParse({ ...valid, purchases: [] }).success).toBe(
      true,
    );
  });

  it.each([
    ["a bad number", { swishNumber: "12345" }],
    ["an empty payee name", { payeeName: "  " }],
    ["a payee name over 40 characters", { payeeName: "x".repeat(41) }],
  ])("rejects %s", (_, change) => {
    expect(CostsSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });

  it.each([
    ["an empty name", { name: " ", price: 10, sharers: [guest] }],
    ["a price of 0", { name: "A", price: 0, sharers: [guest] }],
    ["a price over 100000", { name: "A", price: 100_001, sharers: [guest] }],
    ["a price with öre", { name: "A", price: 10.5, sharers: [guest] }],
    ["no sharer", { name: "A", price: 10, sharers: [] }],
    ["a sharer twice", { name: "A", price: 10, sharers: [guest, guest] }],
    ["a sharer that isn't an id", { name: "A", price: 10, sharers: ["anna"] }],
  ])("rejects a purchase with %s", (_, purchase) => {
    expect(
      CostsSchema.safeParse({ ...valid, purchases: [purchase] }).success,
    ).toBe(false);
  });

  it("accepts the price limits", () => {
    for (const price of [1, 100_000]) {
      expect(
        CostsSchema.safeParse({
          ...valid,
          purchases: [{ name: "A", price, sharers: [guest] }],
        }).success,
      ).toBe(true);
    }
  });
});
