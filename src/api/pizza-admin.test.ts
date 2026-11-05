import { describe, expect, it, vi } from "vitest";
import {
  clearPizzaOrders,
  deletePizzaOrder,
  listPizzaOrders,
  setPizzaOrderDone,
} from "./pizza-admin";
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

const key = "k".repeat(43);
const row = {
  id: "o1",
  name: "Anna",
  pizza: "Capricciosa",
  note: null,
  done: false,
  created_at: "2026-11-05T18:00:00Z",
};

describe("listPizzaOrders", () => {
  it("maps the rows to orders", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { orders: [row] }, error: null });
    const result = await listPizzaOrders(key, fakeClient(rpc));
    expect(rpc).toHaveBeenCalledWith("pizza_admin_orders", { admin_key: key });
    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: "o1",
          name: "Anna",
          pizza: "Capricciosa",
          note: null,
          done: false,
          createdAt: "2026-11-05T18:00:00Z",
        },
      ],
    });
  });

  it("maps an error code from the database", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { error: "forbidden" }, error: null });
    expect(await listPizzaOrders(key, fakeClient(rpc))).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("returns unknown for an answer of the wrong shape", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { orders: [{ id: 1 }] },
      error: null,
    });
    const result = await listPizzaOrders(key, fakeClient(rpc));
    expect(result).toEqual({ ok: false, error: "unknown" });
  });

  it("returns network_error when the call fails, and never logs the key", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "x" } })
      .mockResolvedValue({ data: "logged", error: null });
    const result = await listPizzaOrders(key, fakeClient(rpc));
    expect(result).toEqual({ ok: false, error: "network_error" });
    expect(JSON.stringify(rpc.mock.calls.slice(1))).not.toContain(key);
  });
});

describe("the status calls", () => {
  it.each([
    ["set done", (c: AppClient) => setPizzaOrderDone(key, "o1", true, c)],
    ["delete", (c: AppClient) => deletePizzaOrder(key, "o1", c)],
    ["clear", (c: AppClient) => clearPizzaOrders(key, c)],
  ])("%s returns ok and maps error codes", async (_name, call) => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: "ok", error: null });
    expect(await call(fakeClient(rpc))).toEqual({ ok: true, value: true });
    const rpc2 = vi
      .fn()
      .mockResolvedValue({ data: "rate_limited", error: null });
    expect(await call(fakeClient(rpc2))).toEqual({
      ok: false,
      error: "rate_limited",
    });
    const rpc3 = vi.fn().mockResolvedValue({ data: "not_found", error: null });
    expect(await call(fakeClient(rpc3))).toEqual({
      ok: false,
      error: "not_found",
    });
  });
});
