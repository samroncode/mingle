// Lucky wheel spec (#292), ticket #293: host-actions `update_wheel`. Called
// over HTTP through `supabase functions serve`; the entries are read back
// through the host's normal client.
import { describe, expect, it } from "vitest";
import { anonymousUser, anonymousUsers, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & {
  user: User;
  eventId: string;
  /** Two guests who joined, Anna and Bertil. */
  guests: User[];
};

/** Creates an event through host-actions with two guests who have joined. */
async function createHost(enabledModules: string[] = ["wheel"]): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules,
      party: {},
    },
    { user },
  );
  expect(response.status).toBe(200);
  const link = response.body as HostLink;
  const [eventId = ""] = sql(
    `select id from public.events where code = '${link.code}'`,
  );
  const guests = await anonymousUsers(2);
  for (const [i, guest] of guests.entries()) {
    await guest.client.rpc("join_event", {
      code: link.code,
      display_name: i === 0 ? "Anna" : "Bertil",
    });
  }
  return { ...link, user, eventId, guests };
}

function update(host: Host, change: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "update_wheel", code: link.code, key: link.key, change },
    { user: host.user },
  );
}

type Stored = {
  id: string;
  kind: string;
  member_id: string | null;
  label: string | null;
  state: string;
};

async function listOf(host: Host): Promise<Stored[]> {
  const { data, error } = await host.user.client
    .from("wheel_entries")
    .select("id, kind, member_id, label, state")
    .eq("event_id", host.eventId)
    .order("position");
  if (error) throw error;
  return data;
}

async function summaryOf(host: Host): Promise<string[]> {
  return (await listOf(host)).map(
    (e) => `${e.label ?? (e.member_id ? "guest" : e.kind)}:${e.state}`,
  );
}

describe("update_wheel with the right key", () => {
  it("puts several guests on the wheel at once, answering {}", async () => {
    const host = await createHost();
    const response = await update(host, {
      type: "add_guests",
      ids: host.guests.map((g) => g.id),
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect((await listOf(host)).map((e) => e.member_id)).toEqual(
      host.guests.map((g) => g.id),
    );
  });

  it("adds a custom entry, trimmed", async () => {
    const host = await createHost();
    const response = await update(host, {
      type: "add_custom",
      label: "  Take a shot ",
    });
    expect(response.status).toBe(200);
    expect(await summaryOf(host)).toEqual(["Take a shot:on"]);
  });

  it("takes an entry off, puts it back and deletes it", async () => {
    const host = await createHost();
    await update(host, { type: "add_custom", label: "Dare" });
    const [entry] = await listOf(host);

    expect(
      (await update(host, { type: "take_off", id: entry?.id })).status,
    ).toBe(200);
    expect(await summaryOf(host)).toEqual(["Dare:off"]);

    expect(
      (await update(host, { type: "put_back", id: entry?.id })).status,
    ).toBe(200);
    expect(await summaryOf(host)).toEqual(["Dare:on"]);

    expect((await update(host, { type: "remove", id: entry?.id })).status).toBe(
      200,
    );
    expect(await summaryOf(host)).toEqual([]);
  });

  it("answers already_added for a guest on the wheel", async () => {
    const host = await createHost();
    const ids = host.guests.map((g) => g.id);
    await update(host, { type: "add_guests", ids: [ids[0]] });

    const response = await update(host, { type: "add_guests", ids });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "already_added" });
    expect(await listOf(host)).toHaveLength(1);
  });

  it("answers not_found for a user who isn't a guest of the event", async () => {
    const host = await createHost();
    const other = await createHost();
    const response = await update(host, {
      type: "add_guests",
      ids: [other.guests[0]?.id, host.guests[0]?.id],
    });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
    const hostAsGuest = await update(host, {
      type: "add_guests",
      ids: [host.user.id],
    });
    expect(hostAsGuest.status).toBe(404);
    expect(await listOf(host)).toEqual([]);
  });

  it("answers not_found for an entry of another event", async () => {
    const [host, other] = await Promise.all([createHost(), createHost()]);
    await update(other, { type: "add_custom", label: "Theirs" });
    const [theirs] = await listOf(other);

    for (const type of ["take_off", "put_back", "remove"]) {
      const response = await update(host, { type, id: theirs?.id });
      expect(response.status, type).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
    expect(await summaryOf(other)).toEqual(["Theirs:on"]);
  });

  it("refuses a 25th entry with too_many", async () => {
    const host = await createHost();
    for (let i = 0; i < 24; i++) {
      await update(host, { type: "add_custom", label: `Entry ${i}` });
    }
    const response = await update(host, { type: "add_custom", label: "More" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "too_many" });
    expect(await listOf(host)).toHaveLength(24);
  });

  it("refuses blank or long text with invalid_request and an unknown change", async () => {
    const host = await createHost();
    for (const change of [
      { type: "add_custom", label: "   " },
      { type: "add_custom", label: "x".repeat(31) },
      { type: "add_guests", ids: [] },
      { type: "take_off", id: "not-a-uuid" },
      { type: "spin" },
    ]) {
      const response = await update(host, change);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await listOf(host)).toEqual([]);
  });

  it("refuses with module_disabled while the wheel is switched off, and keeps the entries", async () => {
    const host = await createHost();
    await update(host, { type: "add_custom", label: "Dare" });
    await callHostActions(
      {
        action: "set_modules",
        code: host.code,
        key: host.key,
        modules: ["quiz"],
      },
      { user: host.user },
    );

    const response = await update(host, { type: "add_custom", label: "More" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_disabled" });
    expect(await summaryOf(host)).toEqual(["Dare:on"]);
  });

  it("refuses with invalid_transition after the evening ended", async () => {
    const host = await createHost();
    await setFlow(host, { type: "end_event" });
    const response = await update(host, { type: "add_custom", label: "Late" });
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });
});

describe("update_wheel without the right key", () => {
  async function expectRefused(host: Host, link: HostLink) {
    const response = await update(
      host,
      { type: "add_custom", label: "Sneaky" },
      link,
    );
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await listOf(host)).toEqual([]);
  }

  it("refuses a wrong key", async () => {
    const host = await createHost();
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createHost(), createHost()]);
    await expectRefused(host, { code: host.code, key: other.key });
  });

  it("refuses an unknown code", async () => {
    const host = await createHost();
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("answers a wrong key and an unknown code the same", async () => {
    const host = await createHost();
    const change = { type: "add_custom", label: "B" };
    const wrongKey = await update(host, change, {
      code: host.code,
      key: otherKey(host.key),
    });
    const unknown = await update(host, change, {
      code: unusedCode(),
      key: host.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses a guest who has a wrong key", async () => {
    const host = await createHost();
    const guest = host.guests[0] as User;
    const response = await callHostActions(
      {
        action: "update_wheel",
        code: host.code,
        key: otherKey(host.key),
        change: { type: "add_custom", label: "Sneaky" },
      },
      { user: guest },
    );
    expect(response.status).toBe(403);
    expect(await listOf(host)).toEqual([]);
  });

  it("refuses a caller who is not signed in", async () => {
    const host = await createHost();
    const response = await callHostActions({
      action: "update_wheel",
      code: host.code,
      key: host.key,
      change: { type: "add_custom", label: "Sneaky" },
    });
    expect(response.status).toBe(401);
    expect(await listOf(host)).toEqual([]);
  });

  it("refuses an expired event", async () => {
    const host = await createHost();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );
    const response = await update(host, { type: "add_custom", label: "B" });
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("rate limit on update_wheel", () => {
  const limit = 30;

  it(`allows ${limit} changes per user and event, then refuses`, async () => {
    const host = await createHost();
    await update(host, { type: "add_custom", label: "A" });
    const [first] = await listOf(host);
    for (let i = 1; i < limit; i++) {
      expect(
        (
          await update(host, {
            type: i % 2 ? "take_off" : "put_back",
            id: first?.id,
          })
        ).status,
      ).toBe(200);
    }

    const response = await update(host, { type: "put_back", id: first?.id });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
  });
});

describe("create_event with the wheel", () => {
  it("accepts wheel among the activities", async () => {
    const host = await createHost(["quiz", "wheel"]);
    const [modules] = sql(
      `select enabled_modules::text from public.events where id = '${host.eventId}'`,
    );
    expect(modules).toBe("{quiz,wheel}");
  });

  it("refuses an unknown activity id", async () => {
    const response = await callHostActions(
      {
        action: "create_event",
        niche: "aw",
        language: "sv",
        enabledModules: ["roulette"],
        party: {},
      },
      { user: await anonymousUser() },
    );
    expect(response.status).toBe(400);
  });
});
