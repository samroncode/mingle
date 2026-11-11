import { describe, expect, it } from "vitest";
import { panelSearch, readPanelLocation } from "./panel-view";

describe("readPanelLocation", () => {
  it("reads view and section", () => {
    expect(readPanelLocation("?view=prepare&section=guests")).toEqual({
      view: "prepare",
      section: "guests",
      hasSection: true,
    });
  });

  it("falls back to Run and the first section", () => {
    for (const search of ["", "?view=nope&section=nope", "?view=", "?x=1"]) {
      expect(readPanelLocation(search)).toEqual({
        view: "run",
        section: "quiz",
        hasSection: false,
      });
    }
  });

  it("keeps a known section when the view is unknown", () => {
    expect(readPanelLocation("?view=x&section=costs").section).toBe("costs");
  });

  it("does not take Object.prototype names as a view", () => {
    expect(readPanelLocation("?view=constructor").view).toBe("run");
  });
});

describe("panelSearch", () => {
  it("writes Prepare with a section", () => {
    expect(panelSearch("", "prepare", "guests")).toBe(
      "?view=prepare&section=guests",
    );
  });

  it("writes Prepare without a section", () => {
    expect(panelSearch("", "prepare")).toBe("?view=prepare");
  });

  it("leaves Run with an empty query", () => {
    expect(panelSearch("?view=prepare&section=guests", "run")).toBe("");
  });

  it("replaces the old section and keeps other parameters", () => {
    expect(
      panelSearch("?a=1&view=prepare&section=quiz", "prepare", "party"),
    ).toBe("?a=1&view=prepare&section=party");
    expect(panelSearch("?a=1&view=prepare", "run")).toBe("?a=1");
  });
});
