import { describe, expect, it, vi } from "vitest";
import { submitPizzaOrder } from "./pizza";
import type { AppClient } from "./session";

function fakeClient(rpc: ReturnType<typeof vi.fn>) {
  return {
    rpc,
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
    },
  } as unknown as AppClient;
}

const order = { name: "Anna", pizza: "Capricciosa" };

describe("submitPizzaOrder", () => {
  it("sends the order and returns ok", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "ok", error: null });
    expect(await submitPizzaOrder(order, fakeClient(rpc))).toEqual({
      ok: true,
      value: true,
    });
    expect(rpc).toHaveBeenCalledWith("submit_pizza_order", {
      name: "Anna",
      pizza: "Capricciosa",
      note: undefined,
    });
  });

  it("maps rate_limited and invalid to their codes", async () => {
    for (const code of ["rate_limited", "invalid"] as const) {
      const rpc = vi.fn().mockResolvedValue({ data: code, error: null });
      expect(await submitPizzaOrder(order, fakeClient(rpc))).toEqual({
        ok: false,
        error: code,
      });
    }
  });

  it("returns network_error when the call fails", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "x" } })
      .mockResolvedValue({ data: "logged", error: null });
    expect(await submitPizzaOrder(order, fakeClient(rpc))).toEqual({
      ok: false,
      error: "network_error",
    });
  });
});
