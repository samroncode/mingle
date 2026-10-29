import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import { joinNames, winnerLine } from "./winners";

const member = (user_id: string, display_name: string | null) =>
  ({ user_id, display_name, role: "guest" }) as MemberRow;
const members = [
  member("a", "Anna"),
  member("b", "Bertil"),
  member("c", "Åsa"),
  member("n", null),
];

describe("winnerLine", () => {
  it("names a single winner and the votes", () => {
    expect(winnerLine([{ userId: "a", votes: 4 }], members, "en")).toEqual({
      kind: "winners",
      names: ["Anna"],
      votes: 4,
    });
  });

  it("lists everyone tied, A to Z by the language", () => {
    const tied = [
      { userId: "c", votes: 2 },
      { userId: "b", votes: 2 },
      { userId: "a", votes: 2 },
    ];
    expect(winnerLine(tied, members, "sv")).toEqual({
      kind: "winners",
      names: ["Anna", "Bertil", "Åsa"],
      votes: 2,
    });
  });

  it("has no winner when nobody voted", () => {
    expect(winnerLine([], members, "en")).toEqual({ kind: "none" });
  });

  it("leaves out a winner who is no longer a member or has no name", () => {
    expect(
      winnerLine(
        [
          { userId: "gone", votes: 1 },
          { userId: "n", votes: 1 },
        ],
        members,
        "en",
      ),
    ).toEqual({ kind: "none" });
  });
});

describe("joinNames", () => {
  it("joins names in the language", () => {
    expect(joinNames(["Anna", "Bertil"], "en")).toBe("Anna and Bertil");
    expect(joinNames(["Anna", "Bertil"], "sv")).toBe("Anna och Bertil");
    expect(joinNames(["Anna"], "en")).toBe("Anna");
  });
});
