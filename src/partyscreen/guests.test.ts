import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import { countGuests, guestNames, newGuests } from "./guests";

function member(role: string, name: string | null): MemberRow {
  return {
    created_at: "2026-10-22T10:00:00Z",
    display_name: name,
    event_id: "e1",
    role,
    user_id: `${role}-${name}`,
  };
}

describe("countGuests", () => {
  it("counts only members with the guest role", () => {
    const members = [
      member("host", null),
      member("tv", null),
      member("guest", "Anna"),
      member("guest", "Bo"),
    ];
    expect(countGuests(members)).toBe(2);
  });

  it("leaves out guests who have no name yet", () => {
    const members = [member("guest", "Anna"), member("guest", null)];
    expect(countGuests(members)).toBe(1);
    expect(guestNames(members)).toEqual(["Anna"]);
  });

  it("is zero for an empty event", () => {
    expect(countGuests([])).toBe(0);
  });
});

describe("newGuests", () => {
  const anna = member("guest", "Anna");
  const bo = member("guest", "Bo");

  it("never counts the first snapshot as new", () => {
    expect(newGuests(null, [anna, bo])).toEqual([]);
  });

  it("returns guests that were not in the previous snapshot", () => {
    expect(newGuests([anna], [anna, bo])).toEqual([bo]);
  });

  it("ignores a rename of an existing guest", () => {
    expect(newGuests([anna], [{ ...anna, display_name: "Annie" }])).toEqual([]);
  });

  it("ignores new members that are not guests", () => {
    expect(newGuests([anna], [anna, member("tv", null)])).toEqual([]);
  });

  it("ignores guests without a name", () => {
    expect(newGuests([anna], [anna, member("guest", null)])).toEqual([]);
  });
});
