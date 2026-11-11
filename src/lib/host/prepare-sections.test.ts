import { describe, expect, it } from "vitest";
import { currentSection, prepareGroups } from "./prepare-sections";

describe("prepareGroups", () => {
  it("lists enabled activities in their order, then the switched-off ones", () => {
    const [activities] = prepareGroups(["wheel", "quiz"], false);
    expect(activities?.sections).toEqual([
      "wheel",
      "quiz",
      "awards",
      "hottakes",
      "competitions",
    ]);
  });

  it("has the evening and the event groups", () => {
    const groups = prepareGroups([], false);
    expect(groups.map((group) => group.id)).toEqual([
      "activities",
      "evening",
      "event",
    ]);
    expect(groups[1]?.sections).toEqual([
      "party",
      "program",
      "costs",
      "guests",
      "messages",
      "winners",
    ]);
    expect(groups[2]?.sections).toEqual(["links", "brightroom", "end"]);
  });

  it("keeps only the readable sections after the evening has ended", () => {
    const groups = prepareGroups(["quiz"], true);
    expect(groups.map((group) => group.id)).toEqual(["evening", "event"]);
    expect(groups.flatMap((group) => group.sections)).toEqual([
      "costs",
      "guests",
      "links",
    ]);
  });
});

describe("currentSection", () => {
  const groups = prepareGroups(["quiz"], false);

  it("keeps a section the list has", () => {
    expect(currentSection(groups, "guests")).toBe("guests");
  });

  it("falls back to the first section when the list lacks it", () => {
    expect(currentSection(prepareGroups([], true), "quiz")).toBe("costs");
  });
});
