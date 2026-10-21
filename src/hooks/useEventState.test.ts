// #23: the state useEventState exposes. There is no React testing library in
// the project, so the hook's logic is tested as the pure function it renders;
// the subscription itself is tested against the local stack in
// supabase/tests/realtime.db.test.ts.
import { describe, expect, it } from "vitest";
import type { EventRow, MemberRow } from "@/api/events";
import { initialEventState, nextEventState } from "./useEventState";

const event = { id: "e1", current_module: null } as EventRow;
const later = { id: "e1", current_module: "quiz" } as EventRow;
const members = [{ user_id: "u1", role: "guest" }] as MemberRow[];

describe("useEventState's state", () => {
  it("starts loading, with no event and no members", () => {
    expect(initialEventState).toEqual({
      status: "loading",
      event: null,
      members: [],
      error: null,
    });
  });

  it("is ready with the event and members of a snapshot", () => {
    expect(
      nextEventState(initialEventState, {
        ok: true,
        value: { event, members },
      }),
    ).toEqual({ status: "ready", event, members, error: null });
  });

  it("replaces the event with each newer snapshot", () => {
    const ready = nextEventState(initialEventState, {
      ok: true,
      value: { event, members },
    });
    const next = nextEventState(ready, {
      ok: true,
      value: { event: later, members: [] },
    });
    expect(next).toEqual({
      status: "ready",
      event: later,
      members: [],
      error: null,
    });
  });

  it("reports an error code and keeps the last snapshot on screen", () => {
    const ready = nextEventState(initialEventState, {
      ok: true,
      value: { event, members },
    });
    expect(nextEventState(ready, { ok: false, error: "unknown" })).toEqual({
      status: "error",
      event,
      members,
      error: "unknown",
    });
  });

  it("is ready again once a refetch succeeds after an error", () => {
    const failed = nextEventState(initialEventState, {
      ok: false,
      error: "not_found",
    });
    expect(
      nextEventState(failed, { ok: true, value: { event, members } }),
    ).toEqual({ status: "ready", event, members, error: null });
  });
});
