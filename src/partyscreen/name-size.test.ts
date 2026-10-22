import { describe, expect, it } from "vitest";
import { namesFit, nameSizeRem } from "./name-size";

const firstNames = ["Anna", "Bo", "Maximilian", "Sofia", "Johan", "Lisa-Marie"];

function realisticNames(count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${firstNames[i % firstNames.length]} ${"ABCDEFGHJK"[i % 10]}.`,
  );
}

describe("nameSizeRem", () => {
  it("uses the biggest size for a few names", () => {
    expect(nameSizeRem(["Anna", "Bo"])).toBe(3);
  });

  it("gets smaller as more names have to fit", () => {
    expect(nameSizeRem(realisticNames(5))).toBeGreaterThan(
      nameSizeRem(realisticNames(60)),
    );
  });

  it("gets smaller when the names are longer", () => {
    const short = Array.from({ length: 30 }, () => "Anna");
    const long = Array.from({ length: 30 }, () => "Maximilian Karlsson");
    expect(nameSizeRem(long)).toBeLessThan(nameSizeRem(short));
  });

  it("fits 60 names of realistic length in the area, at a readable size", () => {
    const names = realisticNames(60);
    const size = nameSizeRem(names);
    expect(namesFit(names, size)).toBe(true);
    expect(size).toBeGreaterThanOrEqual(1);
  });

  it("never gets unreadably small", () => {
    expect(nameSizeRem(realisticNames(500))).toBe(1);
  });
});
