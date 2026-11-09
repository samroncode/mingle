import { describe, expect, it } from "vitest";
import { checkMatchEdit } from "./match-edit";

const form = { winnerId: "w", winnerScore: "", loserScore: "" };

describe("checkMatchEdit", () => {
  it("accepts no score and clears it", () => {
    expect(checkMatchEdit("m", form)).toEqual({
      ok: true,
      change: { type: "edit", id: "m", winnerId: "w" },
    });
  });

  it("accepts a winner score above the loser's", () => {
    expect(
      checkMatchEdit("m", { ...form, winnerScore: " 21 ", loserScore: "0" }),
    ).toEqual({
      ok: true,
      change: {
        type: "edit",
        id: "m",
        winnerId: "w",
        score: { winner: 21, loser: 0 },
      },
    });
  });

  it("refuses one score, text and more than 999", () => {
    for (const { winnerScore, loserScore } of [
      { winnerScore: "5", loserScore: "" },
      { winnerScore: "", loserScore: "5" },
      { winnerScore: "a", loserScore: "1" },
      { winnerScore: "1000", loserScore: "1" },
      { winnerScore: "-3", loserScore: "1" },
    ]) {
      expect(checkMatchEdit("m", { ...form, winnerScore, loserScore })).toEqual(
        { ok: false, problem: "invalid_score" },
      );
    }
  });

  it("refuses a winner score that isn't higher", () => {
    for (const { winnerScore, loserScore } of [
      { winnerScore: "10", loserScore: "10" },
      { winnerScore: "3", loserScore: "9" },
    ]) {
      expect(checkMatchEdit("m", { ...form, winnerScore, loserScore })).toEqual(
        { ok: false, problem: "score_mismatch" },
      );
    }
  });
});
