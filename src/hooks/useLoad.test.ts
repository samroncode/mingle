import { describe, expect, it, vi } from "vitest";
import type { Result } from "@/api/errors";
import { nextLoaded, startLoad, stateFor, type Loaded } from "./useLoad";

// There is no React testing library in the project, so the hook's logic is
// tested as the pure pieces it is built from.
const good = (value: string): Result<string, string> => ({ ok: true, value });
const bad: Result<string, string> = { ok: false, error: "unknown" };

function deferred() {
  let resolve!: (result: Result<string, string>) => void;
  const promise = new Promise<Result<string, string>>((r) => (resolve = r));
  return { promise, resolve };
}

describe("startLoad", () => {
  it("reads once and reports the result", async () => {
    const load = vi.fn(() => Promise.resolve(good("a")));
    const done = vi.fn();
    startLoad(load, done);
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(good("a")));
    expect(load).toHaveBeenCalledTimes(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("ignores a late answer once cancelled (key changed or unmounted)", async () => {
    const late = deferred();
    const done = vi.fn();
    const cancel = startLoad(() => late.promise, done);
    cancel();
    late.resolve(good("old"));
    await late.promise;
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
  });

  it("reports a throw as a failure", async () => {
    const done = vi.fn();
    startLoad(() => Promise.reject(new Error("offline")), done);
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(bad));
  });
});

describe("nextLoaded and stateFor", () => {
  it("is loading until something is stored for this key", () => {
    expect(stateFor(undefined, "a")).toEqual({ status: "loading" });
    const stored = nextLoaded(undefined, "a", good("x"), false);
    expect(stateFor(stored, "a")).toEqual({ status: "ready", value: "x" });
    expect(stateFor(stored, "b")).toEqual({ status: "loading" });
  });

  it("fails on a failed read by default", () => {
    const previous: Loaded<string> = nextLoaded(
      undefined,
      "a",
      good("x"),
      false,
    );
    expect(stateFor(nextLoaded(previous, "a", bad, false), "a")).toEqual({
      status: "error",
    });
  });

  it("keeps the last value for the same key on failure when asked to", () => {
    const previous = nextLoaded(undefined, "a", good("x"), true);
    expect(stateFor(nextLoaded(previous, "a", bad, true), "a")).toEqual({
      status: "ready",
      value: "x",
    });
  });

  it("does not keep another key's value on failure", () => {
    const previous = nextLoaded(undefined, "a", good("x"), true);
    expect(stateFor(nextLoaded(previous, "b", bad, true), "b")).toEqual({
      status: "error",
    });
  });
});
