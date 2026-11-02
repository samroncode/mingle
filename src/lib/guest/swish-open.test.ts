import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchSwishOpen } from "./swish-open";

function fakeDoc() {
  const listeners = new Set<() => void>();
  return {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (_type: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) =>
      listeners.delete(fn),
    hide() {
      this.visibilityState = "hidden";
      listeners.forEach((fn) => fn());
    },
    count: () => listeners.size,
  };
}

describe("watchSwishOpen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reports a miss when the page stays in view", () => {
    const doc = fakeDoc();
    const onFailed = vi.fn();
    watchSwishOpen(onFailed, doc as never, 2000);
    vi.advanceTimersByTime(2000);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(doc.count()).toBe(0);
  });

  it("stays quiet when the app opens and the page goes to the background", () => {
    const doc = fakeDoc();
    const onFailed = vi.fn();
    watchSwishOpen(onFailed, doc as never, 2000);
    doc.hide();
    vi.advanceTimersByTime(5000);
    expect(onFailed).not.toHaveBeenCalled();
    expect(doc.count()).toBe(0);
  });

  it("stays quiet after cancel", () => {
    const doc = fakeDoc();
    const onFailed = vi.fn();
    watchSwishOpen(onFailed, doc as never, 2000)();
    vi.advanceTimersByTime(5000);
    expect(onFailed).not.toHaveBeenCalled();
  });
});
