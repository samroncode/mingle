import { describe, expect, it } from "vitest";
import { tablesOf, winnerName } from "./tables";

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

describe("winnerName", () => {
  const match = {
    competitionId: "c1",
    winnerId: "b",
    loserId: "a",
    winnerScore: null,
    loserScore: null,
  };

  it("is the name on top of the table", () => {
    const [table] = tablesOf(competitions, [match], names);
    expect(winnerName(table!)).toBe("Bertil");
  });

  it("is empty when the winner has no known name", () => {
    const [table] = tablesOf(competitions, [match], new Map());
    expect(winnerName(table!)).toBe("");
  });
});
