import { describe, expect, it } from "vitest";
import { settle } from "./useHostAction";

describe("settle", () => {
  it("passes a result through", async () => {
    expect(await settle(() => Promise.resolve({ ok: true as const }))).toEqual({
      ok: true,
    });
  });
  it("turns a throw into a network error", async () => {
    const result = await settle(() => Promise.reject(new Error("offline")));
    expect(result).toEqual({ ok: false, error: "network_error" });
  });
});
