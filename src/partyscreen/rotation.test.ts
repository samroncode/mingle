import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advance, resolveKey, startRotation, successor } from "./rotation";

describe("advance and resolveKey", () => {
  it("moves to the next key and wraps around", () => {
    expect(advance(["a", "b", "c"], "a")).toBe("b");
    expect(advance(["a", "b", "c"], "c")).toBe("a");
  });

  it("stays on a single key", () => {
    expect(advance(["a"], "a")).toBe("a");
  });

  it("falls back to the first key when the current one is gone", () => {
    expect(resolveKey(["b", "c"], "a")).toBe("b");
    expect(resolveKey([], "a")).toBeUndefined();
  });
});

describe("successor", () => {
  it("picks the next part that still exists after the vanished one", () => {
    expect(successor(["a", "b", "c", "d"], ["a", "c", "d"], "b")).toBe("c");
    expect(successor(["a", "b", "c"], ["a", "c"], "b")).toBe("c");
  });

  it("skips other parts that vanished too and wraps around", () => {
    expect(successor(["a", "b", "c"], ["a"], "b")).toBe("a");
    expect(successor(["a", "b", "c"], ["a", "b"], "c")).toBe("a");
  });

  it("starts at the first part when the old key was never in the list", () => {
    expect(successor([], ["x", "y"], "")).toBe("x");
  });

  it("has nothing to move to when no parts remain", () => {
    expect(successor(["a"], [], "a")).toBeUndefined();
  });
});

describe("startRotation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("advances every 12 seconds and wraps", () => {
    const seen: string[] = [];
    startRotation(
      () => ["a", "b"],
      "a",
      12_000,
      (key) => seen.push(key),
    );
    vi.advanceTimersByTime(11_999);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(12_000);
    expect(seen).toEqual(["b", "a"]);
  });

  it("copes with the current part being removed", () => {
    let keys = ["a", "b", "c"];
    const seen: string[] = [];
    startRotation(
      () => keys,
      "b",
      12_000,
      (key) => seen.push(key),
    );
    keys = ["a", "c"];
    vi.advanceTimersByTime(12_000);
    expect(seen).toEqual(["c"]);
  });

  it("picks up a part that is added", () => {
    let keys = ["a"];
    const seen: string[] = [];
    startRotation(
      () => keys,
      "a",
      12_000,
      (key) => seen.push(key),
    );
    vi.advanceTimersByTime(12_000);
    keys = ["a", "b"];
    vi.advanceTimersByTime(12_000);
    expect(seen).toEqual(["a", "b"]);
  });

  it("stops when asked", () => {
    const seen: string[] = [];
    const stop = startRotation(
      () => ["a", "b"],
      "a",
      12_000,
      (key) => seen.push(key),
    );
    stop();
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual([]);
  });
});
