// Lucky wheel spec (#292), ticket #295: the wheel_spins table, the
// "take drawn entries off automatically" setting and the functions that spin
// the wheel. Members read; nobody writes from the client; the functions are
// for host-actions (the service role) only. Behaviour through host-actions is
// in wheel-spin-host-actions.db.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  expireEvent,
  seedCast,
  seedEvent,
  seedMember,
  serviceClient,
  setEventFlow,
  setEventStatus,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;

/** Inserts a spin with the service role. */
async function seedSpin(eventId: string, number: number, label: string) {
  const { error } = await serviceClient()
    .from("wheel_spins")
    .insert({ event_id: eventId, number, label });
  if (error) throw error;
}

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "wheel"] });
  await seedSpin(cast.event.id, 1, "Anna");
  await seedSpin(cast.event.id, 2, "Take a shot");
  await seedSpin(cast.otherEvent.id, 1, "Elsewhere");
});

const memberRoles = ["host", "guestA", "guestB", "tv"] as const;
const outsiderRoles = ["nonMember", "otherHost"] as const;

function user(role: (typeof memberRoles | typeof outsiderRoles)[number]): User {
  return cast[role];
}

async function labelsOf(who: User): Promise<string[]> {
  const { data, error } = await who.client
    .from("wheel_spins")
    .select("label")
    .eq("event_id", cast.event.id)
    .order("number");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.label);
}

describe.each(memberRoles)("the %s", (role) => {
  it("reads the spins of their event in order", async () => {
    expect(await labelsOf(user(role))).toEqual(["Anna", "Take a shot"]);
  });
});

describe.each(outsiderRoles)("the %s", (role) => {
  it("reads no spin of the event", async () => {
    expect(await labelsOf(user(role))).toEqual([]);
  });
});

it("lets a host of another event read only their own spins", async () => {
  const { data } = await cast.otherHost.client
    .from("wheel_spins")
    .select("label");
  expect(data).toEqual([{ label: "Elsewhere" }]);
});

it("lets a user with no session read nothing", async () => {
  const { data } = await signedOutClient().from("wheel_spins").select("id");
  expect(data ?? []).toEqual([]);
});

describe.each([...memberRoles, ...outsiderRoles])("the %s writing", (role) => {
  it("can't insert, change or delete a spin", async () => {
    const { client } = user(role);
    const insert = await client.from("wheel_spins").insert({
      event_id: cast.event.id,
      number: 9,
      label: "Sneaky",
    });
    const update = await client
      .from("wheel_spins")
      .update({ label: "Hacked" })
      .eq("event_id", cast.event.id);
    const remove = await client
      .from("wheel_spins")
      .delete()
      .eq("event_id", cast.event.id);
    expect(insert.error).not.toBeNull();
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(await labelsOf(cast.host)).toEqual(["Anna", "Take a shot"]);
  });
});

describe.each([...memberRoles, ...outsiderRoles])(
  "the %s changing the setting",
  (role) => {
    it("can't write wheel_auto_take_off on the event", async () => {
      const { client } = user(role);
      const update = await client
        .from("events")
        .update({ wheel_auto_take_off: true })
        .eq("id", cast.event.id);
      expect(update.error).not.toBeNull();
      const { data } = await serviceClient()
        .from("events")
        .select("wheel_auto_take_off")
        .eq("id", cast.event.id)
        .single();
      expect(data?.wheel_auto_take_off).toBe(false);
    });
  },
);

describe("the functions", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["spin_wheel", { target_event_id: "" }],
    ["set_wheel_auto_take_off", { target_event_id: "", enabled: true }],
    ["clear_wheel_spins", { target_event_id: "" }],
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
    expect(await labelsOf(cast.host)).toEqual(["Anna", "Take a shot"]);
  });

  it("run with a fixed search_path and as the definer", () => {
    expect(
      sql(
        "select proname || '|' || prosecdef || '|' || coalesce(proconfig::text, '') " +
          "from pg_proc where pronamespace = 'public'::regnamespace " +
          "and proname in ('spin_wheel', 'set_wheel_auto_take_off', " +
          "'clear_wheel_spins') order by 1",
      ),
    ).toEqual([
      'clear_wheel_spins|true|{"search_path=\\"\\""}',
      'set_wheel_auto_take_off|true|{"search_path=\\"\\""}',
      'spin_wheel|true|{"search_path=\\"\\""}',
    ]);
  });
});

/** A fresh live event with the wheel running, `n` guests and `n` entries. */
async function runningWheel(
  guests: number,
  fields: Parameters<typeof seedEvent>[0] = {},
) {
  const event = await seedEvent({
    enabled_modules: ["wheel"],
    status: "live",
    current_module: "wheel",
    ...fields,
  });
  const ids: string[] = [];
  for (let i = 0; i < guests; i++) {
    const u = await anonymousUser();
    await seedMember(event.id, u.id, "guest", `Guest ${i + 1}`);
    ids.push(u.id);
  }
  if (ids.length > 0) {
    const { data } = await serviceClient().rpc("add_wheel_guests", {
      target_event_id: event.id,
      guest_ids: ids,
    });
    expect(data).toBe("added");
  }
  return { event, ids };
}

const spin = (eventId: string) =>
  serviceClient().rpc("spin_wheel", { target_event_id: eventId });

async function spinsOf(eventId: string) {
  const { data } = await serviceClient()
    .from("wheel_spins")
    .select("number, label, entry_id")
    .eq("event_id", eventId)
    .order("number");
  return data ?? [];
}

async function statesOf(eventId: string): Promise<string[]> {
  const { data } = await serviceClient()
    .from("wheel_entries")
    .select("state")
    .eq("event_id", eventId)
    .order("position");
  return (data ?? []).map((row) => row.state);
}

describe("spin_wheel", () => {
  it("stores the winner with the entry, its label at the time and a running number", async () => {
    const { event } = await runningWheel(3);
    expect((await spin(event.id)).data).toBe("spun");
    expect((await spin(event.id)).data).toBe("spun");

    const spins = await spinsOf(event.id);
    expect(spins.map((s) => s.number)).toEqual([1, 2]);
    for (const s of spins) {
      expect(s.label).toMatch(/^Guest [123]$/);
      expect(s.entry_id).not.toBeNull();
    }
    // The wheel is untouched while the setting is off.
    expect(await statesOf(event.id)).toEqual(["on", "on", "on"]);
  });

  it("uses a custom entry's text as the label", async () => {
    const { event } = await runningWheel(0);
    for (const label of ["Dare", "Prize"]) {
      await serviceClient().rpc("add_wheel_custom", {
        target_event_id: event.id,
        entry_label: label,
      });
    }
    await spin(event.id);
    const [first] = await spinsOf(event.id);
    expect(["Dare", "Prize"]).toContain(first?.label);
  });

  it("keeps the label as it was when the guest is renamed later", async () => {
    const { event, ids } = await runningWheel(2);
    await spin(event.id);
    const [first] = await spinsOf(event.id);
    const winnerId = ids[Number(first?.label.slice(-1)) - 1] as string;
    await serviceClient()
      .from("members")
      .update({ display_name: "Renamed" })
      .eq("event_id", event.id)
      .eq("user_id", winnerId);
    expect((await spinsOf(event.id))[0]?.label).toBe(first?.label);
  });

  it("draws every entry of a three-entry wheel and never a taken-off one", async () => {
    const { event } = await runningWheel(3);
    const { data: entries } = await serviceClient()
      .from("wheel_entries")
      .select("id, position")
      .eq("event_id", event.id)
      .order("position");
    const offId = entries?.[2]?.id as string;
    await serviceClient()
      .from("wheel_entries")
      .update({ state: "off" })
      .eq("id", offId);

    // Two on the wheel: both must come up, the third never.
    for (let i = 0; i < 40; i++) await spin(event.id);
    const drawn = new Set((await spinsOf(event.id)).map((s) => s.entry_id));
    expect(drawn).toEqual(new Set([entries?.[0]?.id, entries?.[1]?.id]));
    expect(drawn.has(offId)).toBe(false);

    // All three on the wheel: all three come up.
    await serviceClient()
      .from("wheel_entries")
      .update({ state: "on" })
      .eq("id", offId);
    await serviceClient().rpc("clear_wheel_spins", {
      target_event_id: event.id,
    });
    for (let i = 0; i < 120; i++) await spin(event.id);
    const all = new Set((await spinsOf(event.id)).map((s) => s.entry_id));
    expect(all).toEqual(new Set(entries?.map((e) => e.id)));
  });

  it("takes the winner off the wheel in the same step when the setting is on", async () => {
    const { event } = await runningWheel(3, { wheel_auto_take_off: true });
    expect((await spin(event.id)).data).toBe("spun");
    expect((await statesOf(event.id)).filter((s) => s === "off")).toHaveLength(
      1,
    );
    expect((await spin(event.id)).data).toBe("spun");
    expect((await statesOf(event.id)).filter((s) => s === "off")).toHaveLength(
      2,
    );
    // Nobody is drawn twice, and one entry can't be spun.
    const drawn = (await spinsOf(event.id)).map((s) => s.entry_id);
    expect(new Set(drawn).size).toBe(2);
    expect((await spin(event.id)).data).toBe("not_enough_entries");
    expect(await spinsOf(event.id)).toHaveLength(2);
  });

  it("refuses with fewer than two entries on the wheel, storing nothing", async () => {
    const none = await runningWheel(0);
    expect((await spin(none.event.id)).data).toBe("not_enough_entries");

    const one = await runningWheel(1);
    expect((await spin(one.event.id)).data).toBe("not_enough_entries");

    const twoOneOff = await runningWheel(2);
    await serviceClient()
      .from("wheel_entries")
      .update({ state: "off" })
      .eq("event_id", twoOneOff.event.id)
      .eq("position", 0);
    expect((await spin(twoOneOff.event.id)).data).toBe("not_enough_entries");

    for (const { event } of [none, one, twoOneOff]) {
      expect(await spinsOf(event.id)).toEqual([]);
    }
  });

  it("refuses unless the wheel is the running activity", async () => {
    const idle = await runningWheel(2);
    await setEventFlow(idle.event.id, { current_module: null });
    expect((await spin(idle.event.id)).data).toBe("not_running");

    const other = await runningWheel(2);
    await setEventFlow(other.event.id, { current_module: "quiz" });
    expect((await spin(other.event.id)).data).toBe("not_running");

    const lobby = await runningWheel(2);
    await setEventFlow(lobby.event.id, {
      status: "lobby",
      current_module: null,
    });
    expect((await spin(lobby.event.id)).data).toBe("not_running");

    for (const { event } of [idle, other, lobby]) {
      expect(await spinsOf(event.id)).toEqual([]);
    }
  });

  it("refuses with the wheel off, after the end and for an unknown or expired event", async () => {
    const off = await runningWheel(2, { enabled_modules: ["quiz"] });
    expect((await spin(off.event.id)).data).toBe("disabled");

    const ended = await runningWheel(2);
    await setEventStatus(ended.event.id, "ended");
    expect((await spin(ended.event.id)).data).toBe("ended");

    const expired = await runningWheel(2);
    await expireEvent(expired.event.id);
    expect((await spin(expired.event.id)).data).toBe("not_found");
    expect((await spin("00000000-0000-0000-0000-000000000000")).data).toBe(
      "not_found",
    );
  });

  it("gives parallel spins different numbers", async () => {
    const { event } = await runningWheel(3);
    const answers = await Promise.all([1, 2, 3, 4].map(() => spin(event.id)));
    expect(answers.map((a) => a.data)).toEqual(Array(4).fill("spun"));
    expect((await spinsOf(event.id)).map((s) => s.number)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("keeps the spin but forgets the entry when the entry is deleted", async () => {
    const { event } = await runningWheel(0);
    for (const label of ["A", "B"]) {
      await serviceClient().rpc("add_wheel_custom", {
        target_event_id: event.id,
        entry_label: label,
      });
    }
    await spin(event.id);
    const [first] = await spinsOf(event.id);
    await serviceClient()
      .from("wheel_entries")
      .delete()
      .eq("id", first?.entry_id as string);
    const [after] = await spinsOf(event.id);
    expect(after?.entry_id).toBeNull();
    expect(after?.label).toBe(first?.label);
  });

  it("is deleted with the event", async () => {
    const { event } = await runningWheel(2);
    await spin(event.id);
    await serviceClient().from("events").delete().eq("id", event.id);
    expect(await spinsOf(event.id)).toEqual([]);
  });
});

describe("set_wheel_auto_take_off", () => {
  const set = (eventId: string, enabled: boolean) =>
    serviceClient().rpc("set_wheel_auto_take_off", {
      target_event_id: eventId,
      enabled,
    });

  async function settingOf(eventId: string): Promise<boolean | undefined> {
    const { data } = await serviceClient()
      .from("events")
      .select("wheel_auto_take_off")
      .eq("id", eventId)
      .single();
    return data?.wheel_auto_take_off;
  }

  it("is off by default and switches on and off, also while the wheel runs", async () => {
    const { event } = await runningWheel(2);
    expect(await settingOf(event.id)).toBe(false);
    expect((await set(event.id, true)).data).toBe("updated");
    expect(await settingOf(event.id)).toBe(true);
    expect((await set(event.id, false)).data).toBe("updated");
    expect(await settingOf(event.id)).toBe(false);
  });

  it("refuses with the wheel off, after the end and for an unknown or expired event", async () => {
    const off = await runningWheel(0, { enabled_modules: ["quiz"] });
    expect((await set(off.event.id, true)).data).toBe("disabled");
    expect(await settingOf(off.event.id)).toBe(false);

    const ended = await runningWheel(0);
    await setEventStatus(ended.event.id, "ended");
    expect((await set(ended.event.id, true)).data).toBe("ended");

    const expired = await runningWheel(0);
    await expireEvent(expired.event.id);
    expect((await set(expired.event.id, true)).data).toBe("not_found");
    expect((await set("00000000-0000-0000-0000-000000000000", true)).data).toBe(
      "not_found",
    );
  });
});

describe("clear_wheel_spins", () => {
  const clear = (eventId: string) =>
    serviceClient().rpc("clear_wheel_spins", { target_event_id: eventId });

  it("deletes the spins of the event only, keeping the entries, and numbering restarts", async () => {
    const a = await runningWheel(2);
    const b = await runningWheel(2);
    await spin(a.event.id);
    await spin(b.event.id);

    expect((await clear(a.event.id)).data).toBe("cleared");

    expect(await spinsOf(a.event.id)).toEqual([]);
    expect(await spinsOf(b.event.id)).toHaveLength(1);
    expect(await statesOf(a.event.id)).toEqual(["on", "on"]);
    await spin(a.event.id);
    expect((await spinsOf(a.event.id)).map((s) => s.number)).toEqual([1]);
  });

  it("refuses with the wheel off, after the end and for an unknown or expired event", async () => {
    const off = await runningWheel(0, { enabled_modules: ["quiz"] });
    expect((await clear(off.event.id)).data).toBe("disabled");

    const ended = await runningWheel(0);
    await setEventStatus(ended.event.id, "ended");
    expect((await clear(ended.event.id)).data).toBe("ended");

    const expired = await runningWheel(0);
    await expireEvent(expired.event.id);
    expect((await clear(expired.event.id)).data).toBe("not_found");
    expect((await clear("00000000-0000-0000-0000-000000000000")).data).toBe(
      "not_found",
    );
  });
});

describe("the catalog", () => {
  it("has row level security on, read-only grants and the read policy", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.wheel_spins'::regclass",
      ),
    ).toEqual(["t"]);
    expect(
      sql(
        "select privilege_type from information_schema.role_table_grants " +
          "where table_name = 'wheel_spins' and grantee in ('anon', 'authenticated') order by 1",
      ),
    ).toEqual(["SELECT"]);
    expect(
      sql("select cmd from pg_policies where tablename = 'wheel_spins'"),
    ).toEqual(["SELECT"]);
  });

  it("cascades from the event and forgets a deleted entry", () => {
    expect(
      sql(
        "select confdeltype from pg_constraint where conrelid = 'public.wheel_spins'::regclass " +
          "and contype = 'f' and confrelid = 'public.events'::regclass",
      ),
    ).toEqual(["c"]);
    expect(
      sql(
        "select confdeltype from pg_constraint where conrelid = 'public.wheel_spins'::regclass " +
          "and contype = 'f' and confrelid = 'public.wheel_entries'::regclass",
      ),
    ).toEqual(["n"]);
  });

  it("is in the realtime publication, so views follow a spin", () => {
    expect(
      sql(
        "select 1 from pg_publication_tables where pubname = 'supabase_realtime' " +
          "and schemaname = 'public' and tablename = 'wheel_spins'",
      ),
    ).toEqual(["1"]);
  });
});
