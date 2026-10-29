// #11: members see their event, non-members see nothing, and no client writes
// events or members directly.
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  expireEvent,
  randomCode,
  seedCast,
  seedEvent,
  seedMember,
  serviceClient,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;

beforeAll(async () => {
  cast = await seedCast();
});

const memberRoles = ["host", "guestA", "guestB", "tv"] as const;
const outsiderRoles = ["nonMember", "otherHost"] as const;
const allRoles = [...memberRoles, ...outsiderRoles] as const;

function user(role: (typeof allRoles)[number]): User {
  return cast[role];
}

/** The event as the host sees it, to check that an attempt changed nothing. */
async function eventAsHost() {
  const { data } = await cast.host.client
    .from("events")
    .select()
    .eq("id", cast.event.id)
    .single();
  return data;
}

async function memberIdsAsHost() {
  const { data } = await cast.host.client
    .from("members")
    .select("user_id")
    .eq("event_id", cast.event.id);
  return (data ?? []).map((row) => row.user_id).sort();
}

describe("reading", () => {
  it.each(memberRoles)(
    "the %s can read their event and only it",
    async (role) => {
      const { data, error } = await user(role).client.from("events").select();
      expect(error).toBeNull();
      expect(data?.map((event) => event.id)).toEqual([cast.event.id]);
    },
  );

  it.each(memberRoles)(
    "the %s can read every member of their event",
    async (role) => {
      const { data, error } = await user(role).client.from("members").select();
      expect(error).toBeNull();
      expect(data?.map((member) => member.user_id).sort()).toEqual(
        [cast.host.id, cast.guestA.id, cast.guestB.id, cast.tv.id].sort(),
      );
    },
  );

  it("the TV is told apart from guests by its role", async () => {
    const { data } = await cast.guestA.client
      .from("members")
      .select("user_id, role, display_name")
      .eq("role", "guest");
    expect(data?.map((member) => member.display_name).sort()).toEqual([
      "Anna",
      "Bertil",
    ]);
  });

  it.each(outsiderRoles)(
    "the %s gets the same empty answer whether a code exists or not",
    async (role) => {
      const client = user(role).client;
      const existing = await client
        .from("events")
        .select()
        .eq("code", cast.event.code);
      const unknown = await client
        .from("events")
        .select()
        .eq("code", randomCode());
      expect(existing).toMatchObject({ data: [], error: null });
      expect(unknown).toMatchObject({ data: [], error: null });
    },
  );

  it.each(outsiderRoles)(
    "the %s can't read the members of the event",
    async (role) => {
      const { data, error } = await user(role)
        .client.from("members")
        .select()
        .eq("event_id", cast.event.id);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("the host of another event sees only their own event", async () => {
    const { data } = await cast.otherHost.client.from("events").select("id");
    expect(data).toEqual([{ id: cast.otherEvent.id }]);
  });

  it("a browser without a session can't read events or members", async () => {
    const client = signedOutClient();
    const events = await client.from("events").select();
    const members = await client.from("members").select();
    expect(events.data ?? []).toEqual([]);
    expect(members.data ?? []).toEqual([]);
  });
});

describe("writing events", () => {
  it.each(allRoles)("the %s can't create an event", async (role) => {
    const { data, error } = await user(role)
      .client.from("events")
      .insert({ code: randomCode(), niche: "aw", language: "sv" })
      .select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it.each(allRoles)("the %s can't change the event's flow", async (role) => {
    const before = await eventAsHost();
    const { error } = await user(role)
      .client.from("events")
      .update({ status: "live", current_step: 3, phase: "revealed" })
      .eq("id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await eventAsHost()).toEqual(before);
  });

  it.each(allRoles)("the %s can't delete the event", async (role) => {
    const { error } = await user(role)
      .client.from("events")
      .delete()
      .eq("id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await eventAsHost()).not.toBeNull();
  });
});

describe("writing members", () => {
  it.each(allRoles)("the %s can't add a member row", async (role) => {
    const before = await memberIdsAsHost();
    const { error } = await user(role)
      .client.from("members")
      .insert({
        event_id: cast.event.id,
        user_id: user(role).id,
        role: "host",
      });
    expect(error).not.toBeNull();
    expect(await memberIdsAsHost()).toEqual(before);
  });

  it("a non-member can't make themselves host of the event", async () => {
    const { error } = await cast.nonMember.client.from("members").insert({
      event_id: cast.event.id,
      user_id: cast.nonMember.id,
      role: "host",
    });
    expect(error).not.toBeNull();
    const { data } = await cast.nonMember.client.from("events").select();
    expect(data).toEqual([]);
  });

  it.each(allRoles)("the %s can't remove members", async (role) => {
    const before = await memberIdsAsHost();
    const { error } = await user(role)
      .client.from("members")
      .delete()
      .eq("event_id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await memberIdsAsHost()).toEqual(before);
  });
});

describe("the private schema", () => {
  // The Data API doesn't expose `private`, so the API tests below can't tell
  // whether the grants hold too. These check the grants themselves, as the
  // database roles every client request runs as.
  it.each(["anon", "authenticated"])(
    "gives the %s role no access, even if the schema were exposed",
    (role) => {
      expect(() =>
        sql(`set role ${role}; select count(*) from private.rate_limits`),
      ).toThrow(/permission denied for schema private/);
      expect(() =>
        sql(`set role ${role}; select private.join_failure_limit()`),
      ).toThrow(/permission denied for schema private/);
    },
  );

  it.each(allRoles)("the %s can't read server-only data", async (role) => {
    const { data, error } = await user(role)
      .client.schema("private" as "public")
      .from("rate_limits" as "events")
      .select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("a browser without a session can't read server-only data", async () => {
    const { error } = await signedOutClient()
      .schema("private" as "public")
      .from("rate_limits" as "events")
      .select();
    expect(error).not.toBeNull();
  });

  it("is not exposed even to the service role", async () => {
    const { error } = await serviceClient()
      .schema("private" as "public")
      .from("rate_limits" as "events")
      .select();
    expect(error).not.toBeNull();
  });
});

describe("membership helpers", () => {
  it.each(memberRoles)("the %s is a member of the event", async (role) => {
    const { data } = await user(role).client.rpc("is_member", {
      target_event_id: cast.event.id,
    });
    expect(data).toBe(true);
  });

  it.each(outsiderRoles)(
    "the %s is not a member of the event",
    async (role) => {
      const { data } = await user(role).client.rpc("is_member", {
        target_event_id: cast.event.id,
      });
      expect(data).toBe(false);
    },
  );

  it("only the host is the host of the event", async () => {
    const results = await Promise.all(
      allRoles.map(async (role) => {
        const { data } = await user(role).client.rpc("is_host", {
          target_event_id: cast.event.id,
        });
        return [role, data] as const;
      }),
    );
    expect(Object.fromEntries(results)).toEqual({
      host: true,
      guestA: false,
      guestB: false,
      tv: false,
      nonMember: false,
      otherHost: false,
    });
  });
});

describe("expiry", () => {
  it("an event expires 30 days after it was created", async () => {
    const { data } = await cast.host.client
      .from("events")
      .select("created_at, expires_at")
      .eq("id", cast.event.id)
      .single();
    const days =
      (Date.parse(data!.expires_at) - Date.parse(data!.created_at)) /
      86_400_000;
    expect(days).toBe(30);
  });

  it("after expiry, former members see nothing and are no longer members", async () => {
    const event = await seedEvent();
    const [host, guest, tv] = await Promise.all([
      anonymousUser(),
      anonymousUser(),
      anonymousUser(),
    ]);
    await Promise.all([
      seedMember(event.id, host.id, "host"),
      seedMember(event.id, guest.id, "guest", "Cecilia"),
      seedMember(event.id, tv.id, "tv"),
    ]);
    await expireEvent(event.id);

    for (const member of [host, guest, tv]) {
      const events = await member.client.from("events").select();
      const members = await member.client.from("members").select();
      const isMember = await member.client.rpc("is_member", {
        target_event_id: event.id,
      });
      expect(events.data).toEqual([]);
      expect(members.data).toEqual([]);
      expect(isMember.data).toBe(false);
    }
    const isHost = await host.client.rpc("is_host", {
      target_event_id: event.id,
    });
    expect(isHost.data).toBe(false);
  });
});

describe("table rules", () => {
  it("rejects codes outside the alphabet or of the wrong length", async () => {
    for (const code of [
      "ABC0EF",
      "ABCIEF",
      "ABCLEF",
      "ABCOEF",
      "ABC1EF",
      "abcdef",
      "ABCDE",
      "ABCDEFG",
    ]) {
      await expect(seedEvent({ code })).rejects.toMatchObject({
        code: "23514",
      });
    }
  });

  it("rejects a second event with the same code", async () => {
    const event = await seedEvent();
    await expect(seedEvent({ code: event.code })).rejects.toMatchObject({
      code: "23505",
    });
  });

  it("trims guest names and keeps them 1 to 30 characters", async () => {
    const event = await seedEvent();
    const [trimmed, tooLong, blank, thirty] = await anonymousUsers(4);
    await seedMember(event.id, trimmed.id, "guest", "  Doris \t");
    await expect(
      seedMember(event.id, tooLong.id, "guest", "x".repeat(31)),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      seedMember(event.id, blank.id, "guest", "   "),
    ).rejects.toMatchObject({ code: "23514" });
    await seedMember(event.id, thirty.id, "guest", "y".repeat(30));

    const { data } = await trimmed.client
      .from("members")
      .select("display_name")
      .eq("user_id", trimmed.id)
      .single();
    expect(data?.display_name).toBe("Doris");
  });

  it("requires a name for guests and none for hosts and TVs", async () => {
    const event = await seedEvent();
    const [guest, host, tv] = await anonymousUsers(3);
    await expect(
      seedMember(event.id, guest.id, "guest", null),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      seedMember(event.id, host.id, "host", "Host"),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(seedMember(event.id, tv.id, "tv", "TV")).rejects.toMatchObject(
      {
        code: "23514",
      },
    );
  });

  it("keeps guest names unique per event, ignoring case", async () => {
    const [event, otherEvent] = await Promise.all([seedEvent(), seedEvent()]);
    const [first, second, elsewhere] = await anonymousUsers(3);
    await seedMember(event.id, first.id, "guest", "Erik");
    await expect(
      seedMember(event.id, second.id, "guest", "ERIK"),
    ).rejects.toMatchObject({ code: "23505" });
    await seedMember(otherEvent.id, elsewhere.id, "guest", "Erik");
  });

  it("puts events and members in the realtime publication", () => {
    const tables = sql(
      "select schemaname || '.' || tablename from pg_publication_tables " +
        "where pubname = 'supabase_realtime' order by 1",
    );
    expect(tables).toEqual(
      expect.arrayContaining(["public.events", "public.members"]),
    );
  });
});

describe("guardrail", () => {
  it("every table in public has RLS on", () => {
    const withoutRls = sql(
      "select c.relname from pg_class c " +
        "join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'public' and c.relkind in ('r', 'p') " +
        "and not c.relrowsecurity order by 1",
    );
    expect(withoutRls).toEqual([]);
  });

  it("every table in private has RLS on, with no policies", () => {
    const tables = sql(
      "select c.relname, c.relrowsecurity, " +
        "(select count(*) from pg_policy p where p.polrelid = c.oid) " +
        "from pg_class c join pg_namespace n on n.oid = c.relnamespace " +
        "where n.nspname = 'private' and c.relkind in ('r', 'p') order by 1",
    );
    expect(tables).toContain("rate_limits|t|0");
    expect(tables).toContain("retired_codes|t|0");
    for (const table of tables) expect(table).toMatch(/\|t\|0$/);
  });

  // The nightly cleanup deletes an event and relies on the cascade for
  // everything that belongs to it, in any schema (spec #83).
  it("every foreign key to public.events deletes with the event", () => {
    const cascading = sql(
      "select count(*) from pg_constraint " +
        "where contype = 'f' and confrelid = 'public.events'::regclass " +
        "and confdeltype = 'c'",
    );
    expect(Number(cascading[0])).toBeGreaterThan(0);

    const notCascading = sql(
      "select conrelid::regclass || '.' || conname from pg_constraint " +
        "where contype = 'f' and confrelid = 'public.events'::regclass " +
        "and confdeltype <> 'c' order by 1",
    );
    expect(notCascading).toEqual([]);
  });
});
