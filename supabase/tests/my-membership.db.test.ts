// #42: finding my own membership in the event with a code, tested through the
// data layer's public function against the local stack.
import { describe, expect, it } from "vitest";
import { seedCast, seedEvent, expireEvent } from "./helpers";
import { findMyMembership } from "../../src/api/events";

describe("findMyMembership", () => {
  it("says not a member for a real code when the caller has not joined", async () => {
    const cast = await seedCast();

    expect(
      await findMyMembership(
        cast.event.code,
        cast.nonMember.id,
        cast.nonMember.client,
      ),
    ).toEqual({ ok: true, value: { isMember: false } });
  });

  it("returns the event id and the caller's own role", async () => {
    const cast = await seedCast();

    for (const [user, role] of [
      [cast.guestA, "guest"],
      [cast.guestB, "guest"],
      [cast.tv, "tv"],
      [cast.host, "host"],
    ] as const) {
      expect(
        await findMyMembership(cast.event.code, user.id, user.client),
      ).toEqual({
        ok: true,
        value: { isMember: true, eventId: cast.event.id, role },
      });
    }
  });

  it("trims and upper-cases the code like the join functions", async () => {
    const cast = await seedCast();
    const messy = `  ${cast.event.code.toLowerCase()} `;

    expect(
      await findMyMembership(messy, cast.guestA.id, cast.guestA.client),
    ).toEqual({
      ok: true,
      value: { isMember: true, eventId: cast.event.id, role: "guest" },
    });
  });

  it("says not a member for an unknown code and for an expired event", async () => {
    const cast = await seedCast();
    const expired = await seedEvent();
    await expireEvent(expired.id);

    expect(
      await findMyMembership("ZZZZZZ", cast.guestA.id, cast.guestA.client),
    ).toEqual({ ok: true, value: { isMember: false } });
    expect(
      await findMyMembership(expired.code, cast.guestA.id, cast.guestA.client),
    ).toEqual({ ok: true, value: { isMember: false } });
  });
});
