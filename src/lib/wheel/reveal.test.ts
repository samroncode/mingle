import { describe, expect, it } from "vitest";
import { nextRevealIn, revealDelay, revealedSpins } from "./reveal";
import { spinDurationMs } from "./geometry";

const at = (ms: number) => new Date(ms).toISOString();
const base = Date.parse("2026-11-10T20:00:00Z");

describe("revealedSpins", () => {
  it("hides a spin until the animation time has passed", () => {
    const spins = [{ spunAt: at(base) }];
    expect(revealedSpins(spins, base + spinDurationMs - 1)).toEqual([]);
    expect(revealedSpins(spins, base + spinDurationMs)).toEqual(spins);
  });

  it("shows an old spin at once, as on a late load", () => {
    const spins = [{ spunAt: at(base) }];
    expect(revealedSpins(spins, base + 60_000)).toEqual(spins);
  });

  it("keeps older spins visible while the newest is still spinning", () => {
    const old = { spunAt: at(base - 60_000) };
    const fresh = { spunAt: at(base) };
    expect(revealedSpins([fresh, old], base + 1000)).toEqual([old]);
  });
});

describe("nextRevealIn", () => {
  it("gives the shortest wait among hidden spins", () => {
    const spins = [{ spunAt: at(base) }, { spunAt: at(base - 2000) }];
    expect(nextRevealIn(spins, base)).toBe(spinDurationMs - 2000);
  });

  it("is null when everything is shown", () => {
    expect(nextRevealIn([{ spunAt: at(base - 99_000) }], base)).toBeNull();
    expect(nextRevealIn([], base)).toBeNull();
  });
});

describe("revealDelay", () => {
  it("is the animation time right after the spin", () => {
    expect(revealDelay({ spunAt: at(base) }, base)).toBe(spinDurationMs);
  });
});
