// Lucky wheel spec (#292), ticket #293: the wheel_entries table and the
// functions that change it. Members read; nobody writes from the client; the
// functions are for host-actions (the service role) only. Behaviour through
// host-actions is in wheel-host-actions.db.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  expireEvent,
  seedCast,
  seedEvent,
  seedMember,
  serviceClient,
  setEventStatus,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;

/** Inserts a wheel entry with the service role; returns its id. */
async function seedEntry(
  eventId: string,
  position: number,
  fields: { memberId?: string; label?: string; state?: "on" | "off" },
): Promise<string> {
  const { data, error } = await serviceClient()
    .from("wheel_entries")
    .insert({
      event_id: eventId,
      kind: fields.memberId ? "guest" : "custom",
      member_id: fields.memberId ?? null,
      label: fields.label ?? null,
      state: fields.state ?? "on",
      position,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "wheel"] });
  await seedEntry(cast.event.id, 0, { memberId: cast.guestA.id });
  await seedEntry(cast.event.id, 1, { label: "Take a shot" });
  await seedEntry(cast.otherEvent.id, 0, { label: "Elsewhere" });
});

const memberRoles = ["host", "guestA", "guestB", "tv"] as const;
const outsiderRoles = ["nonMember", "otherHost"] as const;

function user(role: (typeof memberRoles | typeof outsiderRoles)[number]): User {
  return cast[role];
}

async function kindsOf(who: User): Promise<string[]> {
  const { data, error } = await who.client
    .from("wheel_entries")
    .select("kind, label")
    .eq("event_id", cast.event.id)
    .order("position");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.label ?? row.kind);
}

describe.each(memberRoles)("the %s", (role) => {
  it("reads the wheel entries of their event in order", async () => {
    expect(await kindsOf(user(role))).toEqual(["guest", "Take a shot"]);
  });
});

describe.each(outsiderRoles)("the %s", (role) => {
  it("reads no entry of the event", async () => {
    expect(await kindsOf(user(role))).toEqual([]);
  });
});

it("lets a host of another event read only their own entries", async () => {
  const { data } = await cast.otherHost.client
    .from("wheel_entries")
    .select("label");
  expect(data).toEqual([{ label: "Elsewhere" }]);
});

it("lets a user with no session read nothing", async () => {
  const { data } = await signedOutClient().from("wheel_entries").select("id");
  expect(data ?? []).toEqual([]);
});

describe.each([...memberRoles, ...outsiderRoles])("the %s writing", (role) => {
  it("can't insert, change or delete an entry", async () => {
    const { client } = user(role);
    const insert = await client.from("wheel_entries").insert({
      event_id: cast.event.id,
      kind: "custom",
      label: "Sneaky",
      position: 5,
    });
    const update = await client
      .from("wheel_entries")
      .update({ state: "off" })
      .eq("event_id", cast.event.id);
    const remove = await client
      .from("wheel_entries")
      .delete()
      .eq("event_id", cast.event.id);
    expect(insert.error).not.toBeNull();
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(await kindsOf(cast.host)).toEqual(["guest", "Take a shot"]);
    const { data } = await serviceClient()
      .from("wheel_entries")
      .select("state")
      .eq("event_id", cast.event.id);
    expect(data?.every((row) => row.state === "on")).toBe(true);
  });
});

describe("the functions", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["add_wheel_guests", { target_event_id: "", guest_ids: [] }],
    ["add_wheel_custom", { target_event_id: "", entry_label: "X" }],
    [
      "set_wheel_entry_state",
      { target_event_id: "", entry_id: "", new_state: "off" },
    ],
    ["delete_wheel_entry", { target_event_id: "", entry_id: "" }],
  ];

  it.each(calls)("%s can't be called by a client", async (name, args) => {
    const filled = Object.fromEntries(
      Object.entries(args).map(([key, value]) => [
        key,
        value === "" ? cast.event.id : value,
      ]),
    );
    type Rpc = (
      n: string,
      a: object,
    ) => PromiseLike<{ error: { code: string } | null }>;
    for (const who of [cast.host, cast.guestA, cast.tv, cast.nonMember]) {
      const { error } = await (who.client.rpc as Rpc)(name, filled);
      expect(error?.code, name).toBe("42501");
    }
    const signedOut = await (signedOutClient().rpc as Rpc)(name, filled);
    expect(signedOut.error?.code, name).toBe("42501");
    expect(await kindsOf(cast.host)).toEqual(["guest", "Take a shot"]);
  });

  it("keep the lock helper and the trigger function away from clients", () => {
    expect(
      sql(
        "select has_function_privilege('authenticated', " +
          "'private.lock_event_for_wheel(uuid)', 'execute')",
      ),
    ).toEqual(["f"]);
    expect(
      sql(
        "select has_function_privilege('authenticated', " +
          "'private.remove_wheel_entry_of_removed_guest()', 'execute')",
      ),
    ).toEqual(["f"]);
  });

  it("run with a fixed search_path and as the definer", () => {
    expect(
      sql(
        "select proname || '|' || prosecdef || '|' || coalesce(proconfig::text, '') " +
          "from pg_proc where pronamespace = 'public'::regnamespace " +
          "and proname in ('add_wheel_guests', 'add_wheel_custom', " +
          "'set_wheel_entry_state', 'delete_wheel_entry') order by 1",
      ),
    ).toEqual([
      'add_wheel_custom|true|{"search_path=\\"\\""}',
      'add_wheel_guests|true|{"search_path=\\"\\""}',
      'delete_wheel_entry|true|{"search_path=\\"\\""}',
      'set_wheel_entry_state|true|{"search_path=\\"\\""}',
    ]);
  });
});

/** A fresh event with the wheel on, a host and `guests` guests. */
async function eventWith(
  guests: number,
  fields: Parameters<typeof seedEvent>[0] = {},
) {
  const event = await seedEvent({ enabled_modules: ["wheel"], ...fields });
  const users = await Promise.all(
    Array.from({ length: guests }, () => anonymousUser()),
  );
  await Promise.all(
    users.map((u, i) => seedMember(event.id, u.id, "guest", `Guest ${i + 1}`)),
  );
  return { event, guestIds: users.map((u) => u.id) };
}

async function stored(eventId: string): Promise<string[]> {
  const { data } = await serviceClient()
    .from("wheel_entries")
    .select("position, kind, label, state, member_id")
    .eq("event_id", eventId)
    .order("position");
  return (data ?? []).map(
    (row) =>
      `${row.position}:${row.label ?? (row.member_id ? "guest" : row.kind)}:${row.state}`,
  );
}

describe("add_wheel_guests", () => {
  const add = (eventId: string, ids: string[]) =>
    serviceClient().rpc("add_wheel_guests", {
      target_event_id: eventId,
      guest_ids: ids,
    });

  it("puts several guests on the wheel, last and on it, in order", async () => {
    const { event, guestIds } = await eventWith(3);
    expect((await add(event.id, [guestIds[2] as string])).data).toBe("added");
    expect(
      (await add(event.id, [guestIds[0] as string, guestIds[1] as string]))
        .data,
    ).toBe("added");
    expect(await stored(event.id)).toEqual([
      "0:guest:on",
      "1:guest:on",
      "2:guest:on",
    ]);
    const { data } = await serviceClient()
      .from("wheel_entries")
      .select("member_id")
      .eq("event_id", event.id)
      .order("position");
    expect(data?.map((row) => row.member_id)).toEqual([
      guestIds[2],
      guestIds[0],
      guestIds[1],
    ]);
  });

  it("refuses a guest who is already on the wheel, changing nothing", async () => {
    const { event, guestIds } = await eventWith(2);
    await add(event.id, [guestIds[0] as string]);
    expect(
      (await add(event.id, [guestIds[1] as string, guestIds[0] as string]))
        .data,
    ).toBe("already_added");
    expect(await stored(event.id)).toEqual(["0:guest:on"]);
  });

  it("keeps a taken-off guest on the list, so they can't be added twice", async () => {
    const { event, guestIds } = await eventWith(1);
    await add(event.id, guestIds);
    await serviceClient()
      .from("wheel_entries")
      .update({ state: "off" })
      .eq("event_id", event.id);
    expect((await add(event.id, guestIds)).data).toBe("already_added");
  });

  it("refuses a guest listed twice", async () => {
    const { event, guestIds } = await eventWith(1);
    const id = guestIds[0] as string;
    expect((await add(event.id, [id, id])).data).toBe("already_added");
    expect(await stored(event.id)).toEqual([]);
  });

  it("refuses a non-member, a host, a TV, a removed guest and another event's guest", async () => {
    const { event, guestIds } = await eventWith(2);
    const [stranger, host, tv] = await anonymousUsers(3);
    await seedMember(event.id, host.id, "host");
    await seedMember(event.id, tv.id, "tv");
    await serviceClient()
      .from("members")
      .update({ removed_at: new Date().toISOString() })
      .eq("event_id", event.id)
      .eq("user_id", guestIds[1] as string);

    for (const id of [
      stranger.id,
      host.id,
      tv.id,
      guestIds[1] as string,
      cast.guestA.id,
    ]) {
      expect((await add(event.id, [guestIds[0] as string, id])).data, id).toBe(
        "unknown_guest",
      );
    }
    expect((await add(event.id, [])).data).toBe("unknown_guest");
    expect(await stored(event.id)).toEqual([]);
  });

  it("refuses a wheel past 24 entries with too_many, changing nothing", async () => {
    const { event, guestIds } = await eventWith(5);
    for (let i = 0; i < 20; i++) {
      await serviceClient().rpc("add_wheel_custom", {
        target_event_id: event.id,
        entry_label: `Entry ${i}`,
      });
    }
    expect((await add(event.id, guestIds)).data).toBe("too_many");
    expect(await stored(event.id)).toHaveLength(20);
    expect((await add(event.id, guestIds.slice(0, 4))).data).toBe("added");
    expect(await stored(event.id)).toHaveLength(24);
  });

  it("refuses with the wheel off, after the end and for an unknown or expired event", async () => {
    const off = await eventWith(1, { enabled_modules: ["quiz"] });
    expect((await add(off.event.id, off.guestIds)).data).toBe("disabled");

    const ended = await eventWith(1);
    await setEventStatus(ended.event.id, "ended");
    expect((await add(ended.event.id, ended.guestIds)).data).toBe("ended");

    const expired = await eventWith(1);
    await expireEvent(expired.event.id);
    expect((await add(expired.event.id, expired.guestIds)).data).toBe(
      "not_found",
    );
    expect(
      (await add("00000000-0000-0000-0000-000000000000", expired.guestIds))
        .data,
    ).toBe("not_found");
  });
});

describe("add_wheel_custom", () => {
  const add = (eventId: string, label: string) =>
    serviceClient().rpc("add_wheel_custom", {
      target_event_id: eventId,
      entry_label: label,
    });

  it("adds the entry last, trimmed", async () => {
    const { event } = await eventWith(0);
    expect((await add(event.id, "  Take a shot ​")).data).toBe("added");
    expect((await add(event.id, "Pick a song")).data).toBe("added");
    expect(await stored(event.id)).toEqual([
      "0:Take a shot:on",
      "1:Pick a song:on",
    ]);
  });

  it("refuses blank text and text over 30 characters", async () => {
    const { event } = await eventWith(0);
    expect((await add(event.id, "   ")).data).toBe("invalid_name");
    expect((await add(event.id, "x".repeat(31))).data).toBe("invalid_name");
    expect((await add(event.id, "x".repeat(30))).data).toBe("added");
  });

  it("allows the same text twice", async () => {
    const { event } = await eventWith(0);
    expect((await add(event.id, "Dare")).data).toBe("added");
    expect((await add(event.id, "Dare")).data).toBe("added");
  });

  it("refuses a 25th entry with too_many", async () => {
    const { event } = await eventWith(0);
    for (let i = 0; i < 24; i++) await add(event.id, `Entry ${i}`);
    expect((await add(event.id, "One more")).data).toBe("too_many");
    expect(await stored(event.id)).toHaveLength(24);
  });

  it("stays at 24 when several adds arrive at once", async () => {
    const { event } = await eventWith(0);
    for (let i = 0; i < 22; i++) await add(event.id, `Entry ${i}`);
    const answers = await Promise.all(
      ["A", "B", "C", "D"].map((label) => add(event.id, label)),
    );
    expect(answers.filter((a) => a.data === "added")).toHaveLength(2);
    expect(await stored(event.id)).toHaveLength(24);
  });

  it("refuses with the wheel off, after the end and for an unknown or expired event", async () => {
    const off = await eventWith(0, { enabled_modules: ["quiz"] });
    expect((await add(off.event.id, "X")).data).toBe("disabled");

    const ended = await eventWith(0);
    await setEventStatus(ended.event.id, "ended");
    expect((await add(ended.event.id, "X")).data).toBe("ended");

    const expired = await eventWith(0);
    await expireEvent(expired.event.id);
    expect((await add(expired.event.id, "X")).data).toBe("not_found");
    expect((await add("00000000-0000-0000-0000-000000000000", "X")).data).toBe(
      "not_found",
    );
  });
});

describe("set_wheel_entry_state", () => {
  const setState = (eventId: string, id: string, state: string) =>
    serviceClient().rpc("set_wheel_entry_state", {
      target_event_id: eventId,
      entry_id: id,
      new_state: state,
    });

  it("takes an entry off the wheel and puts it back, keeping the row", async () => {
    const { event } = await eventWith(0);
    const id = await seedEntry(event.id, 0, { label: "Dare" });
    expect((await setState(event.id, id, "off")).data).toBe("updated");
    expect(await stored(event.id)).toEqual(["0:Dare:off"]);
    expect((await setState(event.id, id, "on")).data).toBe("updated");
    expect(await stored(event.id)).toEqual(["0:Dare:on"]);
  });

  it("refuses another event's entry and an unknown state", async () => {
    const { event } = await eventWith(0);
    const mine = await seedEntry(event.id, 0, { label: "Dare" });
    const theirs = await seedEntry(cast.otherEvent.id, 5, { label: "Theirs" });
    expect((await setState(event.id, theirs, "off")).data).toBe("unknown");
    expect((await setState(event.id, mine, "gone")).data).toBe("unknown");
    expect(await stored(event.id)).toEqual(["0:Dare:on"]);
    expect(await stored(cast.otherEvent.id)).toContain("5:Theirs:on");
  });

  it("refuses with the wheel off and after the end", async () => {
    const ended = await eventWith(0);
    const id = await seedEntry(ended.event.id, 0, { label: "Dare" });
    await setEventStatus(ended.event.id, "ended");
    expect((await setState(ended.event.id, id, "off")).data).toBe("ended");

    const off = await eventWith(0, { enabled_modules: [] });
    const offId = await seedEntry(off.event.id, 0, { label: "Dare" });
    expect((await setState(off.event.id, offId, "off")).data).toBe("disabled");
  });
});

describe("delete_wheel_entry", () => {
  const remove = (eventId: string, id: string) =>
    serviceClient().rpc("delete_wheel_entry", {
      target_event_id: eventId,
      entry_id: id,
    });

  it("deletes one entry for good", async () => {
    const { event } = await eventWith(0);
    const first = await seedEntry(event.id, 0, { label: "A" });
    await seedEntry(event.id, 1, { label: "B" });
    expect((await remove(event.id, first)).data).toBe("deleted");
    expect(await stored(event.id)).toEqual(["1:B:on"]);
    expect((await remove(event.id, first)).data).toBe("unknown");
  });

  it("lets a deleted guest be added again", async () => {
    const { event, guestIds } = await eventWith(1);
    await serviceClient().rpc("add_wheel_guests", {
      target_event_id: event.id,
      guest_ids: guestIds,
    });
    const [id = ""] = sql(
      `select id from public.wheel_entries where event_id = '${event.id}'`,
    );
    expect((await remove(event.id, id)).data).toBe("deleted");
    const again = await serviceClient().rpc("add_wheel_guests", {
      target_event_id: event.id,
      guest_ids: guestIds,
    });
    expect(again.data).toBe("added");
  });

  it("refuses another event's entry, with the wheel off and after the end", async () => {
    const { event } = await eventWith(0);
    const theirs = await seedEntry(cast.otherEvent.id, 7, { label: "Theirs" });
    expect((await remove(event.id, theirs)).data).toBe("unknown");

    const ended = await eventWith(0);
    const id = await seedEntry(ended.event.id, 0, { label: "A" });
    await setEventStatus(ended.event.id, "ended");
    expect((await remove(ended.event.id, id)).data).toBe("ended");

    const off = await eventWith(0, { enabled_modules: [] });
    const offId = await seedEntry(off.event.id, 0, { label: "A" });
    expect((await remove(off.event.id, offId)).data).toBe("disabled");
  });
});

describe("a guest who leaves the event", () => {
  it("leaves the wheel when the host removes them, and not before", async () => {
    const { event, guestIds } = await eventWith(2);
    await serviceClient().rpc("add_wheel_guests", {
      target_event_id: event.id,
      guest_ids: guestIds,
    });
    await seedEntry(event.id, 5, { label: "Dare" });
    expect(await stored(event.id)).toHaveLength(3);

    const { error } = await serviceClient()
      .from("members")
      .update({ removed_at: new Date().toISOString() })
      .eq("event_id", event.id)
      .eq("user_id", guestIds[0] as string);
    expect(error).toBeNull();

    expect(await stored(event.id)).toEqual(["1:guest:on", "5:Dare:on"]);
  });

  it("leaves the wheel when the member row is deleted", async () => {
    const { event, guestIds } = await eventWith(1);
    await serviceClient().rpc("add_wheel_guests", {
      target_event_id: event.id,
      guest_ids: guestIds,
    });
    await serviceClient()
      .from("members")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", guestIds[0] as string);
    expect(await stored(event.id)).toEqual([]);
  });
});

describe("the catalog", () => {
  it("has row level security on, read-only grants and the read policy", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.wheel_entries'::regclass",
      ),
    ).toEqual(["t"]);
    expect(
      sql(
        "select privilege_type from information_schema.role_table_grants " +
          "where table_name = 'wheel_entries' and grantee in ('anon', 'authenticated') order by 1",
      ),
    ).toEqual(["SELECT"]);
    expect(
      sql(
        "select cmd from pg_policies where tablename = 'wheel_entries' order by 1",
      ),
    ).toEqual(["SELECT"]);
  });

  it("cascades from the event and from the member", () => {
    expect(
      sql(
        "select confdeltype from pg_constraint where conrelid = 'public.wheel_entries'::regclass " +
          "and contype = 'f' order by confrelid::regclass::text",
      ),
    ).toEqual(["c", "c"]);
  });

  it("is in the realtime publication, so views follow a change", () => {
    expect(
      sql(
        "select 1 from pg_publication_tables where pubname = 'supabase_realtime' " +
          "and schemaname = 'public' and tablename = 'wheel_entries'",
      ),
    ).toEqual(["1"]);
  });

  it("is deleted with the event", async () => {
    const { event } = await eventWith(0);
    await seedEntry(event.id, 0, { label: "A" });
    await seedEntry(event.id, 1, { label: "B" });
    await serviceClient().from("events").delete().eq("id", event.id);
    expect(await stored(event.id)).toEqual([]);
  });

  it("refuses text over 30 characters and a guest entry with text, straight into the table", async () => {
    const { event, guestIds } = await eventWith(1);
    const tooLong = await serviceClient()
      .from("wheel_entries")
      .insert({
        event_id: event.id,
        kind: "custom",
        label: "x".repeat(31),
        position: 0,
      });
    const guestWithText = await serviceClient()
      .from("wheel_entries")
      .insert({
        event_id: event.id,
        kind: "guest",
        member_id: guestIds[0] as string,
        label: "Hidden",
        position: 0,
      });
    expect(tooLong.error).not.toBeNull();
    expect(guestWithText.error).not.toBeNull();
  });
});
