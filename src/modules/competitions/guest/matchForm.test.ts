import { describe, expect, it } from "vitest";
import { checkMatchForm, emptyMatchForm, type MatchForm } from "./matchForm";

const filled: MatchForm = {
  ...emptyMatchForm,
  competitionId: "c1",
  opponentId: "bertil",
  outcome: "won",
};

describe("checkMatchForm", () => {
  it("waits until competition, opponent and outcome are chosen", () => {
    for (const form of [
      emptyMatchForm,
      { ...filled, competitionId: undefined },
      { ...filled, opponentId: undefined },
      { ...filled, outcome: undefined },
    ]) {
      expect(checkMatchForm("e", "anna", form)).toEqual({
        ok: false,
        problem: "incomplete",
      });
    }
  });

  it("makes the guest the winner after I won", () => {
    expect(checkMatchForm("e", "anna", filled)).toEqual({
      ok: true,
      report: {
        eventId: "e",
        competitionId: "c1",
        winnerId: "anna",
        loserId: "bertil",
      },
    });
  });

  it("makes the opponent the winner after I lost", () => {
    const check = checkMatchForm("e", "anna", { ...filled, outcome: "lost" });
    expect(check).toMatchObject({
      ok: true,
      report: { winnerId: "bertil", loserId: "anna" },
    });
  });

  it("gives the score to the right side", () => {
    expect(
      checkMatchForm("e", "anna", { ...filled, mine: "11", theirs: "7" }),
    ).toMatchObject({ report: { score: { winner: 11, loser: 7 } } });
    expect(
      checkMatchForm("e", "anna", {
        ...filled,
        outcome: "lost",
        mine: "7",
        theirs: "11",
      }),
    ).toMatchObject({ report: { score: { winner: 11, loser: 7 } } });
  });

  it("accepts a score of 0 and of 999", () => {
    expect(
      checkMatchForm("e", "anna", { ...filled, mine: "999", theirs: "0" }),
    ).toMatchObject({ ok: true, report: { score: { winner: 999, loser: 0 } } });
  });

  it("refuses one score, text, negatives and four digits", () => {
    for (const [mine, theirs] of [
      ["5", ""],
      ["", "5"],
      ["a", "3"],
      ["-1", "0"],
      ["1000", "3"],
      ["2.5", "1"],
    ]) {
      expect(
        checkMatchForm("e", "anna", {
          ...filled,
          mine: mine!,
          theirs: theirs!,
        }),
      ).toEqual({ ok: false, problem: "invalid_score" });
    }
  });

  it("refuses a score where the winner doesn't lead", () => {
    for (const [mine, theirs] of [
      ["3", "5"],
      ["4", "4"],
    ]) {
      expect(
        checkMatchForm("e", "anna", {
          ...filled,
          mine: mine!,
          theirs: theirs!,
        }),
      ).toEqual({ ok: false, problem: "score_mismatch" });
    }
  });
});
