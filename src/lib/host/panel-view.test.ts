import { describe, expect, it } from "vitest";
import { panelSearch, readPanelLocation } from "./panel-view";

describe("readPanelLocation", () => {
  it("reads view and section", () => {
    expect(readPanelLocation("?section=guests")).toEqual({
      view: "prepare",
      section: "guests",
      hasSection: true,
    });
  });

  it("falls back to Prepare and the first section", () => {
    for (const search of ["", "?view=nope&section=nope", "?view=", "?x=1"]) {
      expect(readPanelLocation(search)).toEqual({
        view: "prepare",
        section: "quiz",
        hasSection: false,
      });
    }
  });

  it("keeps a known section when the view is unknown", () => {
    expect(readPanelLocation("?view=x&section=costs").section).toBe("costs");
  });

  it("does not take Object.prototype names as a view", () => {
    expect(readPanelLocation("?view=constructor").view).toBe("prepare");
  });
});

describe("panelSearch", () => {
  it("writes Prepare with a section and no view", () => {
    expect(panelSearch("", "prepare", "guests")).toBe("?section=guests");
  });

  it("writes Prepare without a section as an empty query", () => {
    expect(panelSearch("", "prepare")).toBe("");
  });

  it("writes Run as view=run, dropping the section", () => {
    expect(panelSearch("?section=guests", "run")).toBe("?view=run");
  });

  it("replaces the old section and keeps other parameters", () => {
    expect(panelSearch("?a=1&view=run", "prepare", "party")).toBe(
      "?a=1&section=party",
    );
    expect(panelSearch("?a=1&section=quiz", "run")).toBe("?a=1&view=run");
  });
});
