// Competitions spec (#262), ticket #263: the competitions table and the
// functions that change it. Members read; nobody writes from the client; the
// functions are for host-actions (the service role) only. Behaviour through
// host-actions is in competitions-host-actions.db.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import {
  expireEvent,
  seedCast,
  seedCompetition,
  seedEvent,
  serviceClient,
  setEventStatus,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** The competition ids by position 0 to 2 of the cast's event. */
let ids: string[];

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "competitions"] });
  ids = [
    await seedCompetition(cast.event.id, 0, "Ping pong"),
    await seedCompetition(cast.event.id, 1, "Darts"),
    await seedCompetition(cast.event.id, 2, "Kubb"),
  ];
  await seedCompetition(cast.otherEvent.id, 0, "Elsewhere");
});

const memberRoles = ["host", "guestA", "guestB", "tv"] as const;
const outsiderRoles = ["nonMember", "otherHost"] as const;

function user(role: (typeof memberRoles | typeof outsiderRoles)[number]): User {
  return cast[role];
}

async function namesOf(who: User): Promise<string[]> {
  const { data, error } = await who.client
    .from("competitions")
    .select("name")
    .eq("event_id", cast.event.id)
    .order("position");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.name);
}

describe.each(memberRoles)("the %s", (role) => {
  it("reads the competitions of their event in order", async () => {
    expect(await namesOf(user(role))).toEqual(["Ping pong", "Darts", "Kubb"]);
  });
});

describe.each(outsiderRoles)("the %s", (role) => {
  it("reads no competition of the event", async () => {
    expect(await namesOf(user(role))).toEqual([]);
  });
});

it("lets a host of another event read only their own competitions", async () => {
  const { data } = await cast.otherHost.client
    .from("competitions")
    .select("name");
  expect(data).toEqual([{ name: "Elsewhere" }]);
});

it("lets a user with no session read nothing", async () => {
  const { data } = await signedOutClient().from("competitions").select("name");
  expect(data ?? []).toEqual([]);
});

describe.each([...memberRoles, ...outsiderRoles])("the %s writing", (role) => {
  it("can't insert, rename or delete a competition", async () => {
    const { client } = user(role);
    const insert = await client
      .from("competitions")
      .insert({ event_id: cast.event.id, position: 3, name: "Sneaky" });
    const update = await client
      .from("competitions")
      .update({ name: "Renamed" })
      .eq("event_id", cast.event.id);
    const remove = await client
      .from("competitions")
      .delete()
      .eq("event_id", cast.event.id);
    expect(insert.error).not.toBeNull();
    expect(update.error).not.toBeNull();
    expect(remove.error).not.toBeNull();
    expect(await namesOf(cast.host)).toEqual(["Ping pong", "Darts", "Kubb"]);
  });
});

describe("the functions", () => {
  const calls: [string, Record<string, unknown>][] = [
    ["create_competition", { target_event_id: "", competition_name: "X" }],
    [
      "rename_competition",
      { target_event_id: "", competition_id: "", competition_name: "X" },
    ],
    ["delete_competition", { target_event_id: "", competition_id: "" }],
    ["reorder_competitions", { target_event_id: "", competition_ids: [] }],
  ];

  it.each(calls)("%s can't be called by a client", async (name, args) => {
    const filled = Object.fromEntries(
      Object.entries(args).map(([key, value]) => [
        key,
        value === "" ? cast.event.id : value,
      ]),
    );
    for (const who of [cast.host, cast.guestA, cast.tv]) {
      const { error } = await (
        who.client.rpc as (
          n: string,
          a: object,
        ) => PromiseLike<{
          error: { code: string } | null;
        }>
      )(name, filled);
      expect(error?.code, name).toBe("42501");
    }
    const signedOut = await (
      signedOutClient().rpc as (
        n: string,
        a: object,
      ) => PromiseLike<{
        error: { code: string } | null;
      }>
    )(name, filled);
    expect(signedOut.error?.code, name).toBe("42501");
    expect(await namesOf(cast.host)).toEqual(["Ping pong", "Darts", "Kubb"]);
  });

  it("keeps the lock helper in the private schema, away from clients", () => {
    expect(
      sql(
        "select has_function_privilege('authenticated', " +
          "'private.lock_event_for_competitions(uuid)', 'execute')",
      ),
    ).toEqual(["f"]);
  });

  it("run with a fixed search_path and as the definer", () => {
    expect(
      sql(
        "select proname || '|' || prosecdef || '|' || coalesce(proconfig::text, '') " +
          "from pg_proc where pronamespace = 'public'::regnamespace " +
          "and proname in ('create_competition', 'rename_competition', " +
          "'delete_competition', 'reorder_competitions') order by 1",
      ),
    ).toEqual([
      'create_competition|true|{"search_path=\\"\\""}',
      'delete_competition|true|{"search_path=\\"\\""}',
      'rename_competition|true|{"search_path=\\"\\""}',
      'reorder_competitions|true|{"search_path=\\"\\""}',
    ]);
  });
});

/** A fresh event with Competitions on and `names` as its competitions. */
async function eventWith(
  names: string[],
  fields: Parameters<typeof seedEvent>[0] = {},
) {
  const event = await seedEvent({
    enabled_modules: ["competitions"],
    ...fields,
  });
  const competitionIds: string[] = [];
  for (const [position, name] of names.entries()) {
    competitionIds.push(await seedCompetition(event.id, position, name));
  }
  return { event, ids: competitionIds };
}

async function stored(eventId: string): Promise<string[]> {
  const { data } = await serviceClient()
    .from("competitions")
    .select("position, name")
    .eq("event_id", eventId)
    .order("position");
  return (data ?? []).map((row) => `${row.position}:${row.name}`);
}

describe("create_competition", () => {
  const create = (eventId: string, name: string) =>
    serviceClient().rpc("create_competition", {
      target_event_id: eventId,
      competition_name: name,
    });

  it("adds the competition last, trimmed", async () => {
    const { event } = await eventWith(["Darts"]);
    expect((await create(event.id, "  Kubb ​")).data).toBe("created");
    expect(await stored(event.id)).toEqual(["0:Darts", "1:Kubb"]);
  });

  it("refuses a blank name and a name over 40 characters", async () => {
    const { event } = await eventWith([]);
    expect((await create(event.id, "   ")).data).toBe("invalid_name");
    expect((await create(event.id, "x".repeat(41))).data).toBe("invalid_name");
    expect((await create(event.id, "x".repeat(40))).data).toBe("created");
  });

  it("refuses a sixth competition with too_many", async () => {
    const { event } = await eventWith(["A", "B", "C", "D", "E"]);
    expect((await create(event.id, "F")).data).toBe("too_many");
    expect(await stored(event.id)).toHaveLength(5);
  });

  it("stays at five when several adds arrive at once", async () => {
    const { event } = await eventWith(["A", "B", "C"]);
    const answers = await Promise.all(
      ["D", "E", "F", "G"].map((name) => create(event.id, name)),
    );
    expect(answers.filter((a) => a.data === "created")).toHaveLength(2);
    expect(await stored(event.id)).toHaveLength(5);
  });

  it("refuses with Competitions off, after the end and for an unknown or expired event", async () => {
    const off = await seedEvent({ enabled_modules: ["quiz"] });
    expect((await create(off.id, "Darts")).data).toBe("disabled");

    const { event: ended } = await eventWith([]);
    await setEventStatus(ended.id, "ended");
    expect((await create(ended.id, "Darts")).data).toBe("ended");

    const { event: expired } = await eventWith([]);
    await expireEvent(expired.id);
    expect((await create(expired.id, "Darts")).data).toBe("not_found");
    expect(
      (await create("00000000-0000-0000-0000-000000000000", "Darts")).data,
    ).toBe("not_found");
  });
});

describe("rename_competition", () => {
  const rename = (eventId: string, id: string, name: string) =>
    serviceClient().rpc("rename_competition", {
      target_event_id: eventId,
      competition_id: id,
      competition_name: name,
    });

  it("renames, trimmed, and keeps the position", async () => {
    const { event, ids: made } = await eventWith(["A", "B"]);
    expect(
      (await rename(event.id, made[1] as string, " Beer pong ")).data,
    ).toBe("renamed");
    expect(await stored(event.id)).toEqual(["0:A", "1:Beer pong"]);
  });

  it("refuses a bad name, and a competition of another event", async () => {
    const { event, ids: made } = await eventWith(["A"]);
    expect((await rename(event.id, made[0] as string, " ")).data).toBe(
      "invalid_name",
    );
    expect((await rename(event.id, ids[0] as string, "Hijack")).data).toBe(
      "unknown",
    );
    expect(await namesOf(cast.host)).toEqual(["Ping pong", "Darts", "Kubb"]);
  });

  it("refuses with Competitions off and after the end", async () => {
    const { event, ids: made } = await eventWith(["A"]);
    await setEventStatus(event.id, "ended");
    expect((await rename(event.id, made[0] as string, "B")).data).toBe("ended");

    const off = await eventWith(["A"], { enabled_modules: ["quiz"] });
    expect((await rename(off.event.id, off.ids[0] as string, "B")).data).toBe(
      "disabled",
    );
  });
});

describe("delete_competition", () => {
  const remove = (eventId: string, id: string) =>
    serviceClient().rpc("delete_competition", {
      target_event_id: eventId,
      competition_id: id,
    });

  it("removes one and moves the later ones up", async () => {
    const { event, ids: made } = await eventWith(["A", "B", "C", "D"]);
    expect((await remove(event.id, made[1] as string)).data).toBe("deleted");
    expect(await stored(event.id)).toEqual(["0:A", "1:C", "2:D"]);
  });

  it("lets the freed place be used again", async () => {
    const { event, ids: made } = await eventWith(["A", "B", "C", "D", "E"]);
    await remove(event.id, made[0] as string);
    const { data } = await serviceClient().rpc("create_competition", {
      target_event_id: event.id,
      competition_name: "F",
    });
    expect(data).toBe("created");
    expect(await stored(event.id)).toEqual(["0:B", "1:C", "2:D", "3:E", "4:F"]);
  });

  it("refuses another event's competition and a repeat", async () => {
    const { event, ids: made } = await eventWith(["A"]);
    expect((await remove(event.id, ids[0] as string)).data).toBe("unknown");
    expect((await remove(event.id, made[0] as string)).data).toBe("deleted");
    expect((await remove(event.id, made[0] as string)).data).toBe("unknown");
    expect(await namesOf(cast.host)).toEqual(["Ping pong", "Darts", "Kubb"]);
  });

  it("refuses after the end and with Competitions off", async () => {
    const { event, ids: made } = await eventWith(["A"]);
    await setEventStatus(event.id, "ended");
    expect((await remove(event.id, made[0] as string)).data).toBe("ended");
    const off = await eventWith(["A"], { enabled_modules: [] });
    expect((await remove(off.event.id, off.ids[0] as string)).data).toBe(
      "disabled",
    );
  });
});

describe("reorder_competitions", () => {
  const reorder = (eventId: string, order: string[]) =>
    serviceClient().rpc("reorder_competitions", {
      target_event_id: eventId,
      competition_ids: order,
    });

  it("puts them in the order sent", async () => {
    const { event, ids: made } = await eventWith(["A", "B", "C"]);
    const [a, b, c] = made as [string, string, string];
    expect((await reorder(event.id, [c, a, b])).data).toBe("reordered");
    expect(await stored(event.id)).toEqual(["0:C", "1:A", "2:B"]);
  });

  it("refuses a list that misses one, repeats one or holds a stranger", async () => {
    const { event, ids: made } = await eventWith(["A", "B", "C"]);
    const [a, b, c] = made as [string, string, string];
    expect((await reorder(event.id, [a, b])).data).toBe("mismatch");
    expect((await reorder(event.id, [a, a, b])).data).toBe("mismatch");
    expect((await reorder(event.id, [a, b, ids[0] as string])).data).toBe(
      "mismatch",
    );
    expect((await reorder(event.id, [a, b, c, c])).data).toBe("mismatch");
    expect(await stored(event.id)).toEqual(["0:A", "1:B", "2:C"]);
  });

  it("refuses after the end and with Competitions off", async () => {
    const { event, ids: made } = await eventWith(["A"]);
    await setEventStatus(event.id, "ended");
    expect((await reorder(event.id, made)).data).toBe("ended");
    const off = await eventWith(["A"], { enabled_modules: [] });
    expect((await reorder(off.event.id, off.ids)).data).toBe("disabled");
  });
});

describe("the catalog", () => {
  it("has row level security on, read-only grants and the read policy", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.competitions'::regclass",
      ),
    ).toEqual(["t"]);
    expect(
      sql(
        "select privilege_type from information_schema.role_table_grants " +
          "where table_name = 'competitions' and grantee in ('anon', 'authenticated') order by 1",
      ),
    ).toEqual(["SELECT"]);
    expect(
      sql(
        "select cmd from pg_policies where tablename = 'competitions' order by 1",
      ),
    ).toEqual(["SELECT"]);
  });

  it("cascades from the event", () => {
    expect(
      sql(
        "select confdeltype from pg_constraint where conrelid = 'public.competitions'::regclass " +
          "and contype = 'f' and confrelid = 'public.events'::regclass",
      ),
    ).toEqual(["c"]);
  });

  it("is in the realtime publication, so views follow a change", () => {
    expect(
      sql(
        "select 1 from pg_publication_tables where pubname = 'supabase_realtime' " +
          "and schemaname = 'public' and tablename = 'competitions'",
      ),
    ).toEqual(["1"]);
  });

  it("is deleted with the event", async () => {
    const { event } = await eventWith(["A", "B"]);
    await serviceClient().from("events").delete().eq("id", event.id);
    expect(await stored(event.id)).toEqual([]);
  });
});
