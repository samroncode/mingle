import { describe, expect, it } from "vitest";
import type { MemberRow } from "@/api/events";
import type { WheelEntryView } from "@/api/wheel";
import {
  guestChoices,
  openSuggestions,
  selectAllSteps,
  selectNoneSteps,
  takenOff,
  wheelIsFull,
} from "./participants";

function memberRow(overrides: Partial<MemberRow>): MemberRow {
  return {
    event_id: "ev",
    user_id: "u",
    role: "guest",
    display_name: null,
    created_at: "2026-11-10T10:00:00Z",
    removed_at: null,
    ...overrides,
  };
}

const members = [
  memberRow({ user_id: "u2", display_name: "Bea" }),
  memberRow({ user_id: "u1", display_name: "Ann" }),
  memberRow({ user_id: "u3", display_name: "Cid" }),
  memberRow({ user_id: "h", role: "host", display_name: "Host" }),
];

function entry(overrides: Partial<WheelEntryView>): WheelEntryView {
  return {
    id: "e",
    kind: "custom",
    memberId: null,
    label: "Take a shot",
    state: "on",
    position: 0,
    ...overrides,
  };
}

describe("guestChoices", () => {
  it("lists guests A to Z with their wheel state", () => {
    const entries = [
      entry({ id: "e1", kind: "guest", memberId: "u1", label: null }),
      entry({
        id: "e2",
        kind: "guest",
        memberId: "u2",
        label: null,
        state: "off",
      }),
    ];
    const choices = guestChoices(members, entries, "en");
    expect(choices.map((c) => [c.name, c.entryId, c.onWheel])).toEqual([
      ["Ann", "e1", true],
      ["Bea", "e2", false],
      ["Cid", undefined, false],
    ]);
  });
});

describe("selection steps", () => {
  const entries = [
    entry({ id: "e1", kind: "guest", memberId: "u1", label: null }),
    entry({
      id: "e2",
      kind: "guest",
      memberId: "u2",
      label: null,
      state: "off",
    }),
  ];
  const choices = guestChoices(members, entries, "en");

  it("selects all by putting back and adding the rest in one go", () => {
    expect(selectAllSteps(choices, entries)).toEqual([
      { type: "put_back", id: "e2" },
      { type: "add_guests", ids: ["u3"] },
    ]);
  });

  it("adds only as many guests as fit", () => {
    const many = Array.from({ length: 23 }, (_, i) =>
      entry({ id: `x${i}`, label: `x${i}` }),
    );
    const full = [...many, entry({ id: "y", label: "y" })];
    expect(selectAllSteps(guestChoices(members, many, "en"), many)).toEqual([
      { type: "add_guests", ids: ["u1"] },
    ]);
    expect(selectAllSteps(guestChoices(members, full, "en"), full)).toEqual([]);
  });

  it("selects none by taking off guests on the wheel only", () => {
    expect(selectNoneSteps(choices)).toEqual([{ type: "take_off", id: "e1" }]);
  });
});

describe("wheel state", () => {
  it("counts taken-off entries towards the limit", () => {
    const list = Array.from({ length: 24 }, (_, i) =>
      entry({ id: `x${i}`, state: i === 0 ? "off" : "on" }),
    );
    expect(wheelIsFull(list)).toBe(true);
    expect(wheelIsFull(list.slice(1))).toBe(false);
    expect(takenOff(list)).toHaveLength(1);
  });
});

describe("openSuggestions", () => {
  const suggestions = [
    { id: "a-shot", texts: { sv: "Ta en shot", en: "Take a shot" } },
    { id: "a-song", texts: { sv: "Välj en låt", en: "Pick a song" } },
  ];

  it("uses the event language and hides ones already added", () => {
    expect(openSuggestions(suggestions, "sv", [])).toEqual([
      { id: "a-shot", text: "Ta en shot" },
      { id: "a-song", text: "Välj en låt" },
    ]);
    expect(
      openSuggestions(suggestions, "en", [entry({ label: "take a SHOT" })]),
    ).toEqual([{ id: "a-song", text: "Pick a song" }]);
  });

  it("is empty for a niche without suggestions", () => {
    expect(openSuggestions([], "en", [])).toEqual([]);
  });
});
