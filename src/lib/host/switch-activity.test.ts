import { describe, expect, it, vi } from "vitest";
import { switchActivity, withActivity } from "./switch-activity";

const saved = { ok: true, data: {} } as const;

describe("withActivity", () => {
  it("adds a switched-on activity at the end", () => {
    expect(withActivity(["awards"], "quiz", true)).toEqual(["awards", "quiz"]);
  });

  it("keeps the order of the rest when one goes off", () => {
    expect(
      withActivity(["quiz", "awards", "hottakes"], "awards", false),
    ).toEqual(["quiz", "hottakes"]);
  });

  it("never lists an activity twice", () => {
    expect(withActivity(["quiz"], "quiz", true)).toEqual(["quiz"]);
  });
});

describe("switchActivity", () => {
  it("saves the list, then the default pick when switching on", async () => {
    const send = vi.fn().mockResolvedValue(saved);
    const pick = vi.fn().mockResolvedValue({ ok: true });

    const result = await switchActivity({
      enabled: ["quiz"],
      id: "awards",
      on: true,
      send,
      pick,
    });

    expect(send).toHaveBeenCalledWith(["quiz", "awards"]);
    expect(pick).toHaveBeenCalledOnce();
    expect(result).toEqual({ ok: true, pickFailed: false });
  });

  it("makes no pick when switching off", async () => {
    const send = vi.fn().mockResolvedValue(saved);
    const pick = vi.fn();

    const result = await switchActivity({
      enabled: ["quiz"],
      id: "quiz",
      on: false,
      send,
      pick,
    });

    expect(send).toHaveBeenCalledWith([]);
    expect(pick).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, pickFailed: false });
  });

  it("reports a refusal and makes no pick", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "invalid_transition" });
    const pick = vi.fn();

    const result = await switchActivity({
      enabled: ["quiz"],
      id: "quiz",
      on: false,
      send,
      pick,
    });

    expect(result).toEqual({ ok: false, error: "invalid_transition" });
    expect(pick).not.toHaveBeenCalled();
  });

  it("keeps the activity on when the pick fails or throws", async () => {
    const send = vi.fn().mockResolvedValue(saved);
    for (const pick of [
      vi.fn().mockResolvedValue({ ok: false }),
      vi.fn().mockRejectedValue(new Error("offline")),
    ]) {
      const result = await switchActivity({
        enabled: [],
        id: "quiz",
        on: true,
        send,
        pick,
      });
      expect(result).toEqual({ ok: true, pickFailed: true });
    }
  });
});
