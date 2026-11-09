import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDowntimeWatcher } from "./downtime";

describe("createDowntimeWatcher", () => {
  const onNotice = vi.fn();
  const onLong = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    onNotice.mockClear();
    onLong.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  const watcher = () => createDowntimeWatcher({ onNotice, onLong });

  it("stays quiet for a blip shorter than the delay", () => {
    const w = watcher();
    w.setDown(true);
    vi.advanceTimersByTime(4_000);
    w.setDown(false);
    vi.advanceTimersByTime(120_000);
    expect(onNotice).not.toHaveBeenCalledWith(true);
    expect(onLong).not.toHaveBeenCalled();
  });

  it("shows the notice once the connection has been down past the delay", () => {
    const w = watcher();
    w.setDown(true);
    vi.advanceTimersByTime(4_999);
    expect(onNotice).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onNotice).toHaveBeenCalledWith(true);
  });

  it("removes the notice when the connection is back", () => {
    const w = watcher();
    w.setDown(true);
    vi.advanceTimersByTime(6_000);
    w.setDown(false);
    expect(onNotice).toHaveBeenLastCalledWith(false);
  });

  it("reports a long outage once, after 60 seconds", () => {
    const w = watcher();
    w.setDown(true);
    vi.advanceTimersByTime(59_999);
    expect(onLong).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(120_000);
    expect(onLong).toHaveBeenCalledTimes(1);
  });

  it("ignores repeated signals of the same state", () => {
    const w = watcher();
    w.setDown(true);
    vi.advanceTimersByTime(3_000);
    w.setDown(true);
    vi.advanceTimersByTime(2_000);
    expect(onNotice).toHaveBeenCalledTimes(1);
  });
});
