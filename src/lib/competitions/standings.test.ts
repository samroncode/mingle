import { describe, expect, it } from "vitest";
import { standings, type StandingsMatch } from "./standings";

const names = new Map([
  ["a", "Anna"],
  ["b", "Bo"],
  ["c", "Cecilia"],
]);

function match(
  winnerId: string,
  loserId: string,
  scores?: [number, number],
): StandingsMatch {
  return {
    winnerId,
    loserId,
    winnerScore: scores?.[0] ?? null,
    loserScore: scores?.[1] ?? null,
  };
}

describe("standings", () => {
  it("is empty when nobody has played", () => {
    expect(standings([], names)).toEqual([]);
  });

  it("shows both players of a single match", () => {
    const rows = standings([match("a", "b", [21, 15])], names);
    expect(rows).toEqual([
      {
        userId: "a",
        name: "Anna",
        played: 1,
        wins: 1,
        losses: 0,
        difference: 6,
      },
      {
        userId: "b",
        name: "Bo",
        played: 1,
        wins: 0,
        losses: 1,
        difference: -6,
      },
    ]);
  });

  it("ranks by wins first", () => {
    const rows = standings(
      [match("b", "a", [10, 0]), match("b", "c"), match("a", "c")],
      names,
    );
    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c"]);
  });

  it("breaks a tie on wins by fewer losses", () => {
    const rows = standings(
      [match("a", "c"), match("b", "c"), match("c", "a")],
      names,
    );
    // a: 1-1, b: 1-0, c: 1-2
    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c"]);
  });

  it("breaks a tie on wins and losses by score difference", () => {
    const rows = standings(
      [match("a", "c", [5, 4]), match("b", "c", [21, 0])],
      names,
    );
    expect(rows.map((r) => r.userId)).toEqual(["b", "a", "c"]);
  });

  it("counts matches without scores as a difference of zero", () => {
    const rows = standings([match("a", "b"), match("a", "c", [3, 1])], names);
    expect(rows.find((r) => r.userId === "a")?.difference).toBe(2);
    expect(rows.find((r) => r.userId === "b")?.difference).toBe(0);
  });

  it("falls back to the display name on a full tie", () => {
    const rows = standings([match("b", "c"), match("a", "c")], names);
    expect(rows.map((r) => r.name)).toEqual(["Anna", "Bo", "Cecilia"]);
  });

  it("is stable for a member without a name", () => {
    const rows = standings([match("x", "y")], new Map());
    expect(rows.map((r) => r.userId)).toEqual(["x", "y"]);
  });
});
