// #12 and #13: guests join with a code and a display name, the TV joins with
// the code alone.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  expireEvent,
  randomCode,
  seedEvent,
  seedMember,
  setEventStatus,
  signedOutClient,
  type User,
} from "./helpers";

async function joinEvent(user: User, code: string, displayName: string) {
  return user.client.rpc("join_event", { code, display_name: displayName });
}

async function joinTv(user: User, code: string) {
  return user.client.rpc("join_tv", { code });
}

async function ownRow(user: User, eventId: string) {
  const { data } = await user.client
    .from("members")
    .select("role, display_name")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data;
}

describe("a guest joins", () => {
  it("with a valid code and name, and gets the event id back", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    const { data, error } = await joinEvent(guest, event.code, "Anna");

    expect(error).toBeNull();
    expect(data).toEqual({ event_id: event.id, error: null });
    expect(await ownRow(guest, event.id)).toEqual({
      role: "guest",
      display_name: "Anna",
    });
  });

  it("and can then read the event and its members", async () => {
    const event = await seedEvent();
    const [host, guest] = await anonymousUsers(2);
    await seedMember(event.id, host.id, "host");

    await joinEvent(guest, event.code, "Anna");

    const events = await guest.client.from("events").select("id");
    const members = await guest.client.from("members").select("user_id");
    expect(events.data).toEqual([{ id: event.id }]);
    expect(members.data?.map((m) => m.user_id).sort()).toEqual(
      [host.id, guest.id].sort(),
    );
  });

  it("with a code typed in lower case or with spaces", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    const { data } = await joinEvent(
      guest,
      `  ${event.code.toLowerCase()} `,
      "Anna",
    );

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("with their name trimmed", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    await joinEvent(guest, event.code, "  Anna \n");

    expect((await ownRow(guest, event.id))?.display_name).toBe("Anna");
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["31 characters", "x".repeat(31)],
  ])("not with a name that is %s", async (_, name) => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, event.code, name);

    expect(data).toEqual({ event_id: null, error: "invalid_name" });
    expect(await guest.client.from("events").select()).toMatchObject({
      data: [],
    });
  });

  it("with a 30-character name", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, event.code, "x".repeat(30));

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("not with a name another guest has, ignoring case", async () => {
    const event = await seedEvent();
    const [first, second] = await anonymousUsers(2);
    await joinEvent(first, event.code, "Anna");

    const { data } = await joinEvent(second, event.code, "ANNA");

    expect(data).toEqual({ event_id: null, error: "name_taken" });
    expect(await second.client.from("events").select()).toMatchObject({
      data: [],
    });
  });

  it("with a name a guest of another event has", async () => {
    const [event, otherEvent] = await Promise.all([seedEvent(), seedEvent()]);
    const [first, second] = await anonymousUsers(2);
    await joinEvent(first, otherEvent.code, "Anna");

    const { data } = await joinEvent(second, event.code, "Anna");

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("again from the same session and keeps their name", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();
    await joinEvent(guest, event.code, "Anna");

    const { data, error } = await joinEvent(guest, event.code, "Someone else");

    expect(error).toBeNull();
    expect(data).toEqual({ event_id: event.id, error: null });
    const members = await guest.client.from("members").select("user_id");
    expect(members.data).toEqual([{ user_id: guest.id }]);
    expect((await ownRow(guest, event.id))?.display_name).toBe("Anna");
  });

  it.each(["host", "tv"] as const)(
    "doesn't turn the event's %s into a guest",
    async (role) => {
      const event = await seedEvent();
      const user = await anonymousUser();
      await seedMember(event.id, user.id, role);

      const { data } = await joinEvent(user, event.code, "Anna");

      expect(data).toEqual({ event_id: event.id, error: null });
      expect(await ownRow(user, event.id)).toEqual({
        role,
        display_name: null,
      });
    },
  );

  it("not with an unknown code", async () => {
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, randomCode(), "Anna");

    expect(data).toEqual({ event_id: null, error: "not_found" });
  });

  it("not to an expired event, which looks like an unknown code", async () => {
    const event = await seedEvent();
    await expireEvent(event.id);
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, event.code, "Anna");

    expect(data).toEqual({ event_id: null, error: "not_found" });
  });

  it("not to an ended event", async () => {
    const event = await seedEvent();
    await setEventStatus(event.id, "ended");
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, event.code, "Anna");

    expect(data).toEqual({ event_id: null, error: "ended" });
    expect(await guest.client.from("events").select()).toMatchObject({
      data: [],
    });
  });

  it("with no-break and zero-width spaces trimmed from their name", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    await joinEvent(guest, event.code, " ​Anna　﻿");

    expect((await ownRow(guest, event.id))?.display_name).toBe("Anna");
  });

  it("not with a name of only invisible spaces", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();

    const { data } = await joinEvent(guest, event.code, "​ ﻿");

    expect(data).toEqual({ event_id: null, error: "invalid_name" });
  });

  it("again after the event has ended, and keeps access", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();
    await joinEvent(guest, event.code, "Anna");
    await setEventStatus(event.id, "ended");

    const { data } = await joinEvent(guest, event.code, "Anna");

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("only with a session", async () => {
    const event = await seedEvent();

    const { data, error } = await signedOutClient().rpc("join_event", {
      code: event.code,
      display_name: "Anna",
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("the TV joins", () => {
  it("with a valid code, without a name, and gets the event id back", async () => {
    const event = await seedEvent();
    const tv = await anonymousUser();

    const { data, error } = await joinTv(tv, event.code);

    expect(error).toBeNull();
    expect(data).toEqual({ event_id: event.id, error: null });
    expect(await ownRow(tv, event.id)).toEqual({
      role: "tv",
      display_name: null,
    });
  });

  it("and can read its event and members, but no other event", async () => {
    const [event, otherEvent] = await Promise.all([seedEvent(), seedEvent()]);
    const [tv, guest, otherGuest] = await anonymousUsers(3);
    await joinEvent(guest, event.code, "Anna");
    await joinEvent(otherGuest, otherEvent.code, "Bertil");

    await joinTv(tv, event.code);

    const events = await tv.client.from("events").select("id");
    const members = await tv.client.from("members").select("user_id");
    expect(events.data).toEqual([{ id: event.id }]);
    expect(members.data?.map((m) => m.user_id).sort()).toEqual(
      [tv.id, guest.id].sort(),
    );
  });

  it("and can't write the event or members", async () => {
    const event = await seedEvent();
    const tv = await anonymousUser();
    await joinTv(tv, event.code);

    const update = await tv.client
      .from("events")
      .update({ status: "live" })
      .eq("id", event.id);
    const insert = await tv.client
      .from("members")
      .insert({ event_id: event.id, user_id: tv.id, role: "host" });
    const remove = await tv.client
      .from("members")
      .delete()
      .eq("event_id", event.id);

    expect(update.error).not.toBeNull();
    expect(insert.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    const { data } = await tv.client
      .from("events")
      .select("status")
      .eq("id", event.id)
      .single();
    expect(data?.status).toBe("lobby");
    expect(await ownRow(tv, event.id)).toEqual({
      role: "tv",
      display_name: null,
    });
  });

  it("and isn't in the guest list", async () => {
    const event = await seedEvent();
    const [tv, guest] = await anonymousUsers(2);
    await joinTv(tv, event.code);
    await joinEvent(guest, event.code, "Anna");

    const { data } = await guest.client
      .from("members")
      .select("user_id")
      .eq("role", "guest");

    expect(data).toEqual([{ user_id: guest.id }]);
  });

  it("again from the same session", async () => {
    const event = await seedEvent();
    const tv = await anonymousUser();
    await joinTv(tv, event.code);

    const { data, error } = await joinTv(tv, event.code);

    expect(error).toBeNull();
    expect(data).toEqual({ event_id: event.id, error: null });
    const members = await tv.client.from("members").select("user_id");
    expect(members.data).toEqual([{ user_id: tv.id }]);
  });

  it("without turning the host into a TV", async () => {
    const event = await seedEvent();
    const host = await anonymousUser();
    await seedMember(event.id, host.id, "host");

    await joinTv(host, event.code);

    expect(await ownRow(host, event.id)).toEqual({
      role: "host",
      display_name: null,
    });
  });

  it("without turning a guest into a TV", async () => {
    const event = await seedEvent();
    const guest = await anonymousUser();
    await joinEvent(guest, event.code, "Anna");

    await joinTv(guest, event.code);

    expect(await ownRow(guest, event.id)).toEqual({
      role: "guest",
      display_name: "Anna",
    });
  });

  it("not with an unknown code", async () => {
    const tv = await anonymousUser();

    const { data } = await joinTv(tv, randomCode());

    expect(data).toEqual({ event_id: null, error: "not_found" });
  });

  it("not to an expired event", async () => {
    const event = await seedEvent();
    await expireEvent(event.id);
    const tv = await anonymousUser();

    const { data } = await joinTv(tv, event.code);

    expect(data).toEqual({ event_id: null, error: "not_found" });
  });

  it("not to an ended event", async () => {
    const event = await seedEvent();
    await setEventStatus(event.id, "ended");
    const tv = await anonymousUser();

    const { data } = await joinTv(tv, event.code);

    expect(data).toEqual({ event_id: null, error: "ended" });
  });

  it("again after the event has ended", async () => {
    const event = await seedEvent();
    const tv = await anonymousUser();
    await joinTv(tv, event.code);
    await setEventStatus(event.id, "ended");

    const { data } = await joinTv(tv, event.code);

    expect(data).toEqual({ event_id: event.id, error: null });
  });

  it("only with a session", async () => {
    const event = await seedEvent();

    const { data, error } = await signedOutClient().rpc("join_tv", {
      code: event.code,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
