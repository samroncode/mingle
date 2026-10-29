import type { Database } from "../src/api/database.types.ts";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];

export const fakeEventId = "00000000-0000-0000-0000-0000000000e1";

/** An event row as the database returns it, with `overrides` on top. */
export function eventRow(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: fakeEventId,
    code: "ABC234",
    niche: "aw",
    language: "en",
    status: "lobby",
    current_module: null,
    current_step: 0,
    enabled_modules: [],
    phase: "idle",
    costs_version: 0,
    created_at: "2026-10-22T10:00:00Z",
    expires_at: "2026-11-21T10:00:00Z",
    party: {},
    ...overrides,
  };
}

/** A member row as the database returns it, with `overrides` on top. */
export function memberRow(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    event_id: fakeEventId,
    user_id: "u1",
    role: "guest",
    display_name: null,
    created_at: "2026-10-22T10:00:00Z",
    removed_at: null,
    ...overrides,
  };
}
