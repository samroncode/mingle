import { describe, expect, it, vi } from "vitest";
import type { AppClient } from "./session";
import { cleanRoute, logError } from "./log";

function fakeClient(rpc: ReturnType<typeof vi.fn>) {
  return { rpc } as unknown as AppClient;
}

describe("cleanRoute", () => {
  it("strips the query and the fragment", () => {
    expect(cleanRoute("/host/ABC234?x=1#key=secret")).toBe("/host/ABC234");
    expect(cleanRoute("/p/ABC234#key=secret")).toBe("/p/ABC234");
  });
});

describe("logError", () => {
  it("sends one handled row with area, action and code only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "logged", error: null });
    // Extra fields a careless caller might pass must not go through.
    const entry = {
      area: "costs",
      action: "i_paid",
      code: "unknown",
      amount: 345,
      swishNumber: "46701234567",
      guestName: "Anna",
      key: "secret",
    };
    await logError(entry, fakeClient(rpc));

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(name).toBe("log_client_error");
    expect(Object.keys(args).sort()).toEqual(
      ["action", "area", "error_code", "kind", "route"].sort(),
    );
    expect(args).toMatchObject({
      kind: "handled",
      area: "costs",
      action: "i_paid",
      error_code: "unknown",
    });
    expect(JSON.stringify(args)).not.toMatch(
      /345|46701234567|Anna|secret|amount/,
    );
  });

  it("swallows a rejected call", async () => {
    const rpc = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(
      logError({ area: "costs", action: "x", code: "y" }, fakeClient(rpc)),
    ).resolves.toBeUndefined();
  });

  it("swallows a throw from the client itself", async () => {
    const rpc = vi.fn(() => {
      throw new Error("no settings");
    });
    await expect(
      logError({ area: "costs", action: "x", code: "y" }, fakeClient(rpc)),
    ).resolves.toBeUndefined();
  });
});
