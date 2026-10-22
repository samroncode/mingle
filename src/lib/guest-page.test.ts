import { describe, expect, it } from "vitest";
import type { MyMembership } from "@/api/events";
import { pickGuestPageState, type GuestSnapshot } from "./guest-page";

const guest: MyMembership = { isMember: true, eventId: "e1", role: "guest" };
const live: GuestSnapshot = {
  status: "ready",
  eventStatus: "live",
  error: null,
};

describe("pickGuestPageState", () => {
  it("is loading until the membership lookup answers", () => {
    expect(pickGuestPageState({ lookup: "loading" })).toBe("loading");
  });

  it("shows the name form to someone who has not joined", () => {
    expect(pickGuestPageState({ lookup: { isMember: false } })).toBe("join");
  });

  it("says in for a guest once the event has loaded", () => {
    expect(pickGuestPageState({ lookup: guest, snapshot: live })).toBe("in");
  });

  it("says in for a guest before any snapshot is followed", () => {
    expect(pickGuestPageState({ lookup: guest })).toBe("in");
  });

  it("stays loading for a guest until the first snapshot arrives", () => {
    const snapshot: GuestSnapshot = {
      status: "loading",
      eventStatus: null,
      error: null,
    };
    expect(pickGuestPageState({ lookup: guest, snapshot })).toBe("loading");
  });

  it("tells a host or a TV they are already in, without waiting for a snapshot", () => {
    for (const role of ["host", "tv"] as const) {
      const lookup: MyMembership = { isMember: true, eventId: "e1", role };
      expect(pickGuestPageState({ lookup })).toBe("note");
    }
  });

  it("shows the thank-you for a guest of an ended event", () => {
    const snapshot: GuestSnapshot = { ...live, eventStatus: "ended" };
    expect(pickGuestPageState({ lookup: guest, snapshot })).toBe("ended");
  });

  it("shows the thank-you when joining says the event has ended", () => {
    expect(
      pickGuestPageState({ lookup: { isMember: false }, joinOutcome: "ended" }),
    ).toBe("ended");
  });

  it("shows not found when joining says the code is unknown", () => {
    expect(
      pickGuestPageState({
        lookup: { isMember: false },
        joinOutcome: "not_found",
      }),
    ).toBe("not_found");
  });

  it("shows not found when a guest's event has expired", () => {
    const snapshot: GuestSnapshot = {
      status: "error",
      eventStatus: null,
      error: "not_found",
    };
    expect(pickGuestPageState({ lookup: guest, snapshot })).toBe("not_found");
  });

  it("keeps showing the event during a failed refetch", () => {
    const snapshot: GuestSnapshot = {
      ...live,
      status: "error",
      error: "unknown",
    };
    expect(pickGuestPageState({ lookup: guest, snapshot })).toBe("in");
  });

  it("shows a connection error when the lookup or the first fetch fails", () => {
    expect(pickGuestPageState({ lookup: "failed" })).toBe("error");
    const snapshot: GuestSnapshot = {
      status: "error",
      eventStatus: null,
      error: "unknown",
    };
    expect(pickGuestPageState({ lookup: guest, snapshot })).toBe("error");
  });
});
