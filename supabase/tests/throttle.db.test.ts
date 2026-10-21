// #15: guessing codes is throttled per user, across both join RPCs.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  expireEvent,
  randomCode,
  seedEvent,
  sql,
  type User,
} from "./helpers";

const limit = 10;

function joinEvent(user: User, code: string) {
  return user.client.rpc("join_event", { code, display_name: "Anna" });
}

function joinTv(user: User, code: string) {
  return user.client.rpc("join_tv", { code });
}

async function failTimes(user: User, times: number, join = joinEvent) {
  for (let i = 0; i < times; i++) {
    const { data } = await join(user, randomCode());
    expect(data?.error).toBe("not_found");
  }
}

/**
 * Pretends the failures happened just over a minute ago. The counter is
 * server-only, so only the database owner can move it.
 */
function moveWindowBack(user: User) {
  sql(
    `update private.rate_limits set window_start = window_start - interval '61 seconds' ` +
      `where user_id = '${user.id}'`,
  );
}

describe("code guessing", () => {
  it(`is refused after ${limit} failures, even with a valid code`, async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit);

    const asGuest = await joinEvent(guesser, event.code);
    const asTv = await joinTv(guesser, event.code);

    expect(asGuest.data).toEqual({ event_id: null, error: "rate_limited" });
    expect(asTv.data).toEqual({ event_id: null, error: "rate_limited" });
    expect(await guesser.client.from("events").select()).toMatchObject({
      data: [],
    });
  });

  it(`is still allowed after ${limit - 1} failures`, async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit - 1);

    const { data } = await joinEvent(guesser, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("doesn't count successful joins", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();
    await failTimes(guest, limit - 1);
    for (let i = 0; i < limit; i++) await joinEvent(guest, event.code);
    await joinTv(guest, event.code);

    const { data } = await joinEvent(guest, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("counts an expired code as a failure", async () => {
    const [event, expired] = await Promise.all([seedEvent(), seedEvent()]);
    await expireEvent(expired.id);
    const guesser = await anonymousUser();
    await failTimes(guesser, limit - 1);

    await joinTv(guesser, expired.code);
    const { data } = await joinEvent(guesser, event.code);

    expect(data).toEqual({ event_id: null, error: "rate_limited" });
  });

  it("shares one counter between join_event and join_tv", async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit / 2, joinEvent);
    await failTimes(guesser, limit / 2, joinTv);

    const { data } = await joinEvent(guesser, event.code);

    expect(data).toEqual({ event_id: null, error: "rate_limited" });
  });

  it("doesn't affect other users", async () => {
    const event = await seedEvent();
    const [guesser, guest] = await anonymousUsers(2);
    await failTimes(guesser, limit);

    const { data } = await joinEvent(guest, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("is allowed again once the window has passed", async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit);
    moveWindowBack(guesser);

    const { data } = await joinEvent(guesser, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("starts a fresh count once the window has passed", async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit - 1);
    moveWindowBack(guesser);
    await failTimes(guesser, limit - 1);

    const { data } = await joinEvent(guesser, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("can't be reset by the client", async () => {
    const event = await seedEvent();
    const guesser = await anonymousUser();
    await failTimes(guesser, limit);

    const remove = await guesser.client
      .schema("private" as "public")
      .from("rate_limits" as "events")
      .delete()
      .neq("id", "");
    const rpc = await guesser.client.rpc(
      "record_join_failure" as "is_member",
      {} as { target_event_id: string },
    );

    expect(remove.error).not.toBeNull();
    expect(rpc.error).not.toBeNull();
    const { data } = await joinEvent(guesser, event.code);
    expect(data).toEqual({ event_id: null, error: "rate_limited" });
  });
});
