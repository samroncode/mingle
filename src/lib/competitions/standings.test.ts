import { describe, expect, it } from "vitest";
import { standings, tablesOf, type StandingsMatch } from "./standings";

const names = new Map([
  ["a", "Anna"],
  ["b", "Bertil"],
  ["c", "Cecilia"],
]);

function m(
  winnerId: string,
  loserId: string,
  winnerScore: number | null = null,
  loserScore: number | null = null,
): StandingsMatch {
  return { winnerId, loserId, winnerScore, loserScore };
}

describe("standings", () => {
  it("is empty when nobody played", () => {
    expect(standings([], names)).toEqual([]);
  });

  it("counts one match for both players", () => {
    expect(standings([m("a", "b")], names)).toEqual([
      { playerId: "a", name: "Anna", played: 1, wins: 1, losses: 0, diff: 0 },
      { playerId: "b", name: "Bertil", played: 1, wins: 0, losses: 1, diff: 0 },
    ]);
  });

  it("ranks by wins first", () => {
    const rows = standings([m("b", "a"), m("b", "c"), m("a", "c")], names);
    expect(rows.map((r) => r.name)).toEqual(["Bertil", "Anna", "Cecilia"]);
  });

  it("breaks equal wins by fewer losses", () => {
    // Anna 1-0, Bertil 1-1: Anna first.
    const rows = standings([m("a", "c"), m("b", "c"), m("c", "b")], names);
    expect(rows.map((r) => r.name)).toEqual(["Anna", "Bertil", "Cecilia"]);
  });

  it("breaks equal wins and losses by score difference", () => {
    const rows = standings([m("a", "c", 11, 9), m("b", "c", 11, 2)], names);
    expect(rows.map((r) => r.name)).toEqual(["Bertil", "Anna", "Cecilia"]);
    expect(rows[0]?.diff).toBe(9);
    expect(rows[2]?.diff).toBe(-11);
  });

  it("counts matches without scores as zero difference", () => {
    const rows = standings([m("a", "b", 11, 5), m("a", "c")], names);
    expect(rows.find((r) => r.playerId === "a")?.diff).toBe(6);
    expect(rows.find((r) => r.playerId === "c")?.diff).toBe(0);
  });

  it("falls back to display name on a full tie", () => {
    const rows = standings([m("b", "c"), m("a", "c")], names);
    expect(rows.map((r) => r.name)).toEqual(["Anna", "Bertil", "Cecilia"]);
  });

  it("keeps a player with an unknown name", () => {
    const rows = standings([m("x", "a")], names);
    expect(rows[0]).toMatchObject({ playerId: "x", name: "" });
  });
});

describe("tablesOf", () => {
  const competitions = [
    { id: "c1", name: "Ping pong" },
    { id: "c2", name: "Darts" },
  ];

  it("leaves out competitions without a match", () => {
    const tables = tablesOf(
      competitions,
      [{ competitionId: "c2", ...m("a", "b") }],
      names,
    );
    expect(tables.map((t) => t.name)).toEqual(["Darts"]);
  });

  it("is empty when no match exists", () => {
    expect(tablesOf(competitions, [], names)).toEqual([]);
  });
});
