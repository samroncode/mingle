import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import { voteCandidates } from "./candidates";

function member(
  user_id: string,
  display_name: string | null,
  role = "guest",
): MemberRow {
  return {
    event_id: "e1",
    user_id,
    role,
    display_name,
    created_at: "2026-10-23T18:00:00Z",
  };
}

describe("voteCandidates", () => {
  it("lists the other guests A to Z and leaves the voter out", () => {
    const members = [
      member("h", null, "host"),
      member("g1", "Östen"),
      member("me", "Maja"),
      member("g2", "Zorro"),
      member("g3", "anna"),
      member("t", null, "tv"),
    ];
    expect(voteCandidates(members, "me", "sv").map((c) => c.name)).toEqual([
      "anna",
      "Zorro",
      "Östen",
    ]);
  });

  it("sorts Å Ä Ö after Z in Swedish and among their base letters in English", () => {
    const members = [member("a", "Åsa"), member("b", "Zed"), member("c", "Bo")];
    const names = (language: string) =>
      voteCandidates(members, "me", language).map((c) => c.name);
    expect(names("sv")).toEqual(["Bo", "Zed", "Åsa"]);
    expect(names("en")).toEqual(["Åsa", "Bo", "Zed"]);
  });

  it("skips guests without a display name", () => {
    expect(voteCandidates([member("g", null)], "me", "en")).toEqual([]);
  });

  it("is empty with nobody else to vote for", () => {
    expect(voteCandidates([member("me", "Maja")], "me", "en")).toEqual([]);
  });
});
