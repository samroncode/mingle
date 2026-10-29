import { describe, expect, it } from "vitest";
import { hostPanelErrorKey, orderActivities, tvNow } from "./host-panel";

const base = { status: "live", current_module: "quiz", phase: "idle" };

describe("tvNow", () => {
  it("says party screen when no activity runs", () => {
    expect(
      tvNow({ ...base, current_module: null }, undefined, undefined).key,
    ).toBe("hostPanel.tv.party");
  });

  it("names the activity for every phase", () => {
    for (const phase of ["idle", "open", "revealed"]) {
      const now = tvNow({ ...base, phase }, "Quiz", undefined);
      expect(now.key).toBe(`hostPanel.tv.activity.${phase}`);
      expect(now.values).toEqual({ name: "Quiz", progress: "" });
    }
  });

  it("adds the activity's progress when it has one", () => {
    const now = tvNow({ ...base, phase: "open" }, "Quiz", "question 3 of 10");
    expect(now.key).toBe("hostPanel.tv.withProgress.open");
    expect(now.values.progress).toBe("question 3 of 10");
  });

  it("says the evening ended", () => {
    expect(tvNow({ ...base, status: "ended" }, "Quiz", undefined).key).toBe(
      "hostPanel.tv.ended",
    );
  });
});

describe("orderActivities", () => {
  it("keeps the enabled order and puts the rest last", () => {
    expect(orderActivities(["hottakes", "quiz"])).toEqual({
      enabled: ["hottakes", "quiz"],
      disabled: ["awards"],
    });
  });

  it("ignores unknown and repeated ids", () => {
    expect(orderActivities(["nope", "awards", "awards"]).enabled).toEqual([
      "awards",
    ]);
  });
});

describe("hostPanelErrorKey", () => {
  it("maps known codes and falls back to a generic message", () => {
    expect(hostPanelErrorKey("rate_limited")).toBe(
      "hostPanel.errors.rate_limited",
    );
    expect(hostPanelErrorKey("module_empty")).toBe(
      "hostPanel.errors.module_empty",
    );
    expect(hostPanelErrorKey("module_finished")).toBe(
      "hostPanel.errors.module_finished",
    );
    expect(hostPanelErrorKey("name_taken")).toBe("hostPanel.errors.name_taken");
    expect(hostPanelErrorKey("invalid_name")).toBe(
      "hostPanel.errors.invalid_name",
    );
    expect(hostPanelErrorKey("not_found")).toBe("hostPanel.errors.not_found");
    expect(hostPanelErrorKey("internal_error")).toBe(
      "hostPanel.errors.internal_error",
    );
  });
});
