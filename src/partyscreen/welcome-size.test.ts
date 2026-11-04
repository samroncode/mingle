import { describe, expect, it } from "vitest";
import { welcomeSize } from "./welcome-size";

describe("welcomeSize", () => {
  it("makes a short greeting the biggest", () => {
    expect(welcomeSize("Välkommen på AW!")).toContain("text-9xl");
  });

  it("steps down as the text grows", () => {
    expect(welcomeSize("x".repeat(40))).toContain("text-7xl");
    expect(welcomeSize("x".repeat(120))).toContain("text-5xl");
    expect(welcomeSize("x".repeat(400))).toContain("text-4xl");
  });

  it("ignores surrounding spaces", () => {
    expect(welcomeSize(`  ${"x".repeat(24)}  `)).toContain("text-9xl");
  });
});
