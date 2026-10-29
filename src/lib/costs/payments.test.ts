import { describe, expect, it } from "vitest";
import { paymentStatus } from "./payments";

describe("paymentStatus", () => {
  it("owes when nothing has happened", () => {
    expect(paymentStatus(120)).toBe("owes");
  });

  it("says paid once the guest says so", () => {
    expect(paymentStatus(120, { saysPaid: true, confirmedKr: null })).toBe(
      "says_paid",
    );
  });

  it("is paid once the host confirmed the whole total", () => {
    expect(paymentStatus(120, { saysPaid: false, confirmedKr: 120 })).toBe(
      "paid",
    );
  });

  it("is back to owes when the total grew after the confirmation", () => {
    expect(paymentStatus(170, { saysPaid: false, confirmedKr: 120 })).toBe(
      "owes",
    );
  });

  it("is says paid when the guest says they paid the rest", () => {
    expect(paymentStatus(170, { saysPaid: true, confirmedKr: 120 })).toBe(
      "says_paid",
    );
  });
});
