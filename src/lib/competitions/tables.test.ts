import { describe, expect, it } from "vitest";
import { tablesOf } from "./tables";

const names = new Map([
  ["a", "Anna"],
  ["b", "Bertil"],
]);
const competitions = [
  { id: "c1", name: "Ping pong" },
  { id: "c2", name: "Darts" },
];

describe("tablesOf", () => {
  it("leaves out competitions without a match", () => {
    const tables = tablesOf(
      competitions,
      [
        {
          competitionId: "c2",
          winnerId: "a",
          loserId: "b",
          winnerScore: null,
          loserScore: null,
        },
      ],
      names,
    );
    expect(tables.map((t) => t.name)).toEqual(["Darts"]);
    expect(tables[0]?.rows.map((r) => r.name)).toEqual(["Anna", "Bertil"]);
  });

  it("is empty when no match exists", () => {
    expect(tablesOf(competitions, [], names)).toEqual([]);
  });
});
