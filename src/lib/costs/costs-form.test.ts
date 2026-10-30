import { describe, expect, it } from "vitest";
import type { CostsView } from "@/api/costs";
import {
  costsToForm,
  hasErrors,
  nationalNumber,
  newPurchaseForm,
  parseCostsForm,
  type CostsForm,
} from "./costs-form";

const anna = "7f9c3c9e-52a1-4a52-9d0e-1c8f6a7b2d11";
const bertil = "0b1e6c1e-4d57-4c3a-8c55-5a2a1f0c9e22";

const saved: CostsView = {
  payeeName: "Sam",
  swishNumber: "46701234567",
  billSentAt: null,
  payments: new Map(),
  purchases: [
    { id: "p1", name: "Drinks", price: 450, sharers: [anna, "removed-guest"] },
  ],
};

function form(overrides: Partial<CostsForm> = {}): CostsForm {
  return {
    payeeName: "Sam",
    swishNumber: "070-123 45 67",
    purchases: [
      { key: "k", name: "Pizza", price: "1 200", sharers: [anna, bertil] },
    ],
    ...overrides,
  };
}

describe("newPurchaseForm", () => {
  it("is shared by every guest, with its own key", () => {
    const first = newPurchaseForm([anna, bertil]);
    const second = newPurchaseForm([anna, bertil]);

    expect(first.sharers).toEqual([anna, bertil]);
    expect(first.key).not.toBe(second.key);
  });
});

describe("costsToForm", () => {
  it("is empty while shared costs are off", () => {
    expect(costsToForm(null, [anna])).toEqual({
      payeeName: "",
      swishNumber: "",
      purchases: [],
    });
  });

  it("shows the number in national form and drops sharers who left", () => {
    expect(costsToForm(saved, [anna, bertil])).toEqual({
      payeeName: "Sam",
      swishNumber: "0701234567",
      purchases: [{ key: "p1", name: "Drinks", price: "450", sharers: [anna] }],
    });
  });

  it("writes a stored number the way a host types it", () => {
    expect(nationalNumber("46721234567")).toBe("0721234567");
  });
});

describe("parseCostsForm", () => {
  it("turns a valid form into costs with a normalised number and whole price", () => {
    const result = parseCostsForm(form());

    expect(result).toEqual({
      ok: true,
      costs: {
        payeeName: "Sam",
        swishNumber: "46701234567",
        purchases: [{ name: "Pizza", price: 1200, sharers: [anna, bertil] }],
      },
    });
  });

  it("accepts no purchases", () => {
    expect(parseCostsForm(form({ purchases: [] })).ok).toBe(true);
  });

  it("points at a bad number and an empty payee name", () => {
    const result = parseCostsForm(form({ swishNumber: "123", payeeName: " " }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.swishNumber).toBe(true);
      expect(result.errors.payeeName).toBe(true);
      expect(hasErrors(result.errors)).toBe(true);
    }
  });

  it.each(["", "0", "100001", "12,5", "abc", "-5"])(
    "points at the price %j",
    (price) => {
      const purchases = [
        { key: "a", name: "Ok", price: "10", sharers: [anna] },
        { key: "b", name: "Bad", price, sharers: [anna] },
      ];

      const result = parseCostsForm(form({ purchases }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.purchases).toEqual([
          { name: false, price: false, sharers: false },
          { name: false, price: true, sharers: false },
        ]);
      }
    },
  );

  it("points at an empty name and a purchase nobody shares", () => {
    const purchases = [{ key: "a", name: " ", price: "10", sharers: [] }];

    const result = parseCostsForm(form({ purchases }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.purchases).toEqual([
        { name: true, price: false, sharers: true },
      ]);
    }
  });
});
