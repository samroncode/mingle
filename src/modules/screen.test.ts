import { describe, expect, it } from "vitest";
import { pickScreen } from "./screen";
import type { ModuleDefinition } from "./types";

const quiz = { id: "quiz" } as ModuleDefinition;
const definitions = { quiz };

describe("pickScreen", () => {
  it("shows the party screen when no module runs", () => {
    expect(pickScreen(null, definitions)).toEqual({ kind: "party" });
  });

  it("shows the view of a module that has a definition", () => {
    expect(pickScreen("quiz", definitions)).toEqual({
      kind: "module",
      definition: quiz,
    });
  });

  it("keeps the party screen for a module without a definition", () => {
    expect(pickScreen("awards", definitions)).toEqual({ kind: "party" });
  });

  it("keeps the party screen for an unknown module id", () => {
    expect(pickScreen("toString", definitions)).toEqual({ kind: "party" });
    expect(pickScreen("karaoke", definitions)).toEqual({ kind: "party" });
  });

  it("knows the real definitions", () => {
    expect(pickScreen("quiz").kind).toBe("module");
    expect(pickScreen("hottakes").kind).toBe("module");
  });
});
