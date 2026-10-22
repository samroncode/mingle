import { describe, expect, it, vi } from "vitest";
import { keepScreenAwake } from "./wake-lock";

function setup() {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release }));
  const listeners = new Map<string, () => void>();
  const doc = {
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (type: string, listener: () => void) =>
      listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  return { request, release, listeners, doc, nav: { wakeLock: { request } } };
}

describe("keepScreenAwake", () => {
  it("asks for a screen wake lock", () => {
    const { nav, doc, request } = setup();
    keepScreenAwake(nav, doc);
    expect(request).toHaveBeenCalledWith("screen");
  });

  it("asks again when the tab becomes visible", () => {
    const { nav, doc, request, listeners } = setup();
    keepScreenAwake(nav, doc);
    listeners.get("visibilitychange")?.();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("does not ask while the tab is hidden", () => {
    const { nav, doc, request, listeners } = setup();
    keepScreenAwake(nav, doc);
    doc.visibilityState = "hidden";
    listeners.get("visibilitychange")?.();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does nothing where unsupported", () => {
    const { doc, listeners } = setup();
    const stop = keepScreenAwake({}, doc);
    expect(listeners.size).toBe(0);
    expect(() => stop()).not.toThrow();
  });

  it("survives a refused request and releases on stop", async () => {
    const { nav, doc, release, request, listeners } = setup();
    request.mockRejectedValueOnce(new Error("denied"));
    const stop = keepScreenAwake(nav, doc);
    listeners.get("visibilitychange")?.();
    await Promise.resolve();
    await Promise.resolve();
    stop();
    await Promise.resolve();
    expect(release).toHaveBeenCalled();
    expect(listeners.size).toBe(0);
  });

  it("releases the held lock when it asks again, so stop leaks none", async () => {
    const first = { release: vi.fn(() => Promise.resolve()) };
    const second = { release: vi.fn(() => Promise.resolve()) };
    const { nav, doc, request, listeners } = setup();
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const stop = keepScreenAwake(nav, doc);
    await Promise.resolve();
    listeners.get("visibilitychange")?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.release).toHaveBeenCalledTimes(1);
    stop();
    await Promise.resolve();
    await Promise.resolve();
    expect(second.release).toHaveBeenCalledTimes(1);
  });
});
