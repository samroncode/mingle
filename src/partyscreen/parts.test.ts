import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import { partsOf } from "./parts";

function member(role: string, name: string | null): MemberRow {
  return {
    created_at: "2026-10-22T10:00:00Z",
    removed_at: null,
    display_name: name,
    event_id: "e1",
    role,
    user_id: `${role}-${name}`,
  };
}

const full = {
  welcome: "Hi all",
  menu: ["Pizza"],
  schedule: [{ time: "19:00", title: "Dinner" }],
  wifi: { ssid: "Home", password: "pw" },
  musicUrl: "https://open.spotify.com/jam/x",
};

describe("partsOf", () => {
  it("lists welcome, menu, schedule, wifi, music and guests in that order", () => {
    const parts = partsOf(full, [member("guest", "Anna")]);
    expect(parts.map((part) => part.kind)).toEqual([
      "welcome",
      "menu",
      "schedule",
      "wifi",
      "music",
      "guests",
    ]);
  });

  it("adds winners after the schedule, unless empty or hidden", () => {
    const winners = [{ title: "Darts", name: "Anna" }];
    const kinds = (party: object) =>
      partsOf({ ...full, ...party }, []).map((part) => part.kind);
    expect(kinds({ winners })).toContain("winners");
    expect(kinds({ winners })).toEqual([
      "welcome",
      "menu",
      "schedule",
      "winners",
      "wifi",
      "music",
    ]);
    expect(kinds({ winners: [] })).not.toContain("winners");
    expect(kinds({ winners, winnersHidden: true })).not.toContain("winners");
  });

  it("leaves out parts the host left empty, and guests when nobody joined", () => {
    expect(partsOf({ welcome: "Hi", menu: [] }, [])).toEqual([
      { kind: "welcome", text: "Hi" },
    ]);
  });

  it("lists only guests by name", () => {
    const parts = partsOf({}, [
      member("host", null),
      member("tv", null),
      member("guest", "Anna"),
      member("guest", null),
    ]);
    expect(parts).toEqual([{ kind: "guests", names: ["Anna"] }]);
  });
});
