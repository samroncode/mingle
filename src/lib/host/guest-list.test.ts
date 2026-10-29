import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import { sortedGuests } from "./guest-list";

function member(
  role: string,
  user_id: string,
  display_name: string | null,
): MemberRow {
  return {
    role,
    user_id,
    display_name,
    event_id: "e",
    created_at: "2026-10-29T10:00:00Z",
    removed_at: null,
  };
}

describe("sortedGuests", () => {
  it("lists named guests A to Z, ignoring case, without hosts and TVs", () => {
    const list = sortedGuests(
      [
        member("host", "h", null),
        member("guest", "1", "zoe"),
        member("tv", "t", null),
        member("guest", "2", "Anna"),
        member("guest", "3", "björn"),
      ],
      "en",
    );
    expect(list.map((g) => g.name)).toEqual(["Anna", "björn", "zoe"]);
    expect(list.map((g) => g.userId)).toEqual(["2", "3", "1"]);
  });

  it("sorts å, ä and ö after z in Swedish", () => {
    const list = sortedGuests(
      [member("guest", "1", "Åsa"), member("guest", "2", "Zoe")],
      "sv",
    );
    expect(list.map((g) => g.name)).toEqual(["Zoe", "Åsa"]);
  });
});
