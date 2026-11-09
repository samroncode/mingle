// Competitions spec (#262), ticket #263: host-actions `update_competitions`
// and `create_event` with competitions. Called over HTTP through `supabase
// functions serve`; the list is read back through the host's normal client.
import { describe, expect, it } from "vitest";
import { anonymousUser, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };

/** Creates an event through host-actions, with the competitions given. */
async function createHost(
  names: string[] = [],
  enabledModules: string[] = ["competitions"],
): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules,
      party: {},
      ...(names.length > 0
        ? { competitions: names.map((name) => ({ name })) }
        : {}),
    },
    { user },
  );
  expect(response.status).toBe(200);
  const link = response.body as HostLink;
  const [eventId = ""] = sql(
    `select id from public.events where code = '${link.code}'`,
  );
  return { ...link, user, eventId };
}

function update(host: Host, change: unknown, link: HostLink = host) {
  return callHostActions(
    {
      action: "update_competitions",
      code: link.code,
      key: link.key,
      change,
    },
    { user: host.user },
  );
}

type Stored = { id: string; position: number; name: string };

/** The event's competitions in order, as the host reads them. */
async function listOf(host: Host): Promise<Stored[]> {
  const { data, error } = await host.user.client
    .from("competitions")
    .select("id, position, name")
    .eq("event_id", host.eventId)
    .order("position");
  if (error) throw error;
  return data;
}

async function namesOf(host: Host): Promise<string[]> {
  return (await listOf(host)).map((c) => c.name);
}

describe("create_event with competitions", () => {
  it("stores them in order from position 0", async () => {
    const host = await createHost(["Ping pong", "Darts", "Kubb"]);
    expect(await listOf(host)).toEqual([
      expect.objectContaining({ position: 0, name: "Ping pong" }),
      expect.objectContaining({ position: 1, name: "Darts" }),
      expect.objectContaining({ position: 2, name: "Kubb" }),
    ]);
  });

  it("works without competitions, with Competitions on or off", async () => {
    expect(await namesOf(await createHost([]))).toEqual([]);
    expect(await namesOf(await createHost([], ["quiz"]))).toEqual([]);
  });

  it("refuses a sixth competition, a blank name and a long name", async () => {
    for (const names of [
      ["A", "B", "C", "D", "E", "F"],
      [" "],
      ["x".repeat(41)],
    ]) {
      const response = await callHostActions(
        {
          action: "create_event",
          niche: "aw",
          language: "sv",
          enabledModules: ["competitions"],
          party: {},
          competitions: names.map((name) => ({ name })),
        },
        { user: await anonymousUser() },
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
  });

  it("refuses competitions while Competitions is switched off", async () => {
    const response = await callHostActions(
      {
        action: "create_event",
        niche: "aw",
        language: "sv",
        enabledModules: ["quiz"],
        party: {},
        competitions: [{ name: "Darts" }],
      },
      { user: await anonymousUser() },
    );
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});

describe("update_competitions with the right key", () => {
  it("adds a competition last, trimmed, answering {}", async () => {
    const host = await createHost(["Darts"]);

    const response = await update(host, { type: "add", name: "  Kubb " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await namesOf(host)).toEqual(["Darts", "Kubb"]);
  });

  it("renames a competition and keeps its place", async () => {
    const host = await createHost(["Darts", "Kubb"]);
    const [first] = await listOf(host);

    const response = await update(host, {
      type: "rename",
      id: first?.id,
      name: "Beer pong",
    });

    expect(response.status).toBe(200);
    expect(await namesOf(host)).toEqual(["Beer pong", "Kubb"]);
  });

  it("removes a competition and moves the later ones up", async () => {
    const host = await createHost(["A", "B", "C"]);
    const [, second] = await listOf(host);

    expect(
      (await update(host, { type: "remove", id: second?.id })).status,
    ).toBe(200);

    expect(await listOf(host)).toEqual([
      expect.objectContaining({ position: 0, name: "A" }),
      expect.objectContaining({ position: 1, name: "C" }),
    ]);
  });

  it("reorders the competitions", async () => {
    const host = await createHost(["A", "B", "C"]);
    const ids = (await listOf(host)).map((c) => c.id);

    const response = await update(host, {
      type: "reorder",
      ids: [ids[2], ids[0], ids[1]],
    });

    expect(response.status).toBe(200);
    expect(await namesOf(host)).toEqual(["C", "A", "B"]);
  });

  it("refuses a sixth competition with too_many", async () => {
    const host = await createHost(["A", "B", "C", "D", "E"]);

    const response = await update(host, { type: "add", name: "F" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "too_many" });
    expect(await namesOf(host)).toHaveLength(5);
  });

  it("refuses a blank or too long name and an unknown change", async () => {
    const host = await createHost(["A"]);
    for (const change of [
      { type: "add", name: "   " },
      { type: "add", name: "x".repeat(41) },
      { type: "swap" },
      { type: "remove", id: "not-a-uuid" },
    ]) {
      const response = await update(host, change);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await namesOf(host)).toEqual(["A"]);
  });

  it("answers not_found for a competition of another event", async () => {
    const [host, other] = await Promise.all([
      createHost(["A"]),
      createHost(["Theirs"]),
    ]);
    const [theirs] = await listOf(other);

    for (const change of [
      { type: "rename", id: theirs?.id, name: "Mine" },
      { type: "remove", id: theirs?.id },
    ]) {
      const response = await update(host, change);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
    expect(await namesOf(other)).toEqual(["Theirs"]);
  });

  it("refuses a reorder that misses or adds a competition", async () => {
    const [host, other] = await Promise.all([
      createHost(["A", "B"]),
      createHost(["Theirs"]),
    ]);
    const ids = (await listOf(host)).map((c) => c.id);
    const [theirs] = await listOf(other);

    for (const list of [[ids[0]], [ids[0], ids[0]], [ids[0], theirs?.id]]) {
      const response = await update(host, { type: "reorder", ids: list });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await namesOf(host)).toEqual(["A", "B"]);
  });

  it("refuses with module_disabled while Competitions is switched off", async () => {
    const host = await createHost(["A"]);
    await callHostActions(
      {
        action: "set_modules",
        code: host.code,
        key: host.key,
        modules: ["quiz"],
      },
      { user: host.user },
    );

    const response = await update(host, { type: "add", name: "B" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_disabled" });
    expect(await namesOf(host)).toEqual(["A"]);
  });

  it("keeps the competitions when Competitions is switched off and on again", async () => {
    const host = await createHost(["A"]);
    for (const modules of [["quiz"], ["quiz", "competitions"]]) {
      await callHostActions(
        { action: "set_modules", code: host.code, key: host.key, modules },
        { user: host.user },
      );
    }
    expect(await namesOf(host)).toEqual(["A"]);
    expect((await update(host, { type: "add", name: "B" })).status).toBe(200);
  });

  it("refuses with invalid_transition after the evening ended", async () => {
    const host = await createHost(["A"]);
    await setFlow(host, { type: "end_event" });

    const response = await update(host, { type: "add", name: "B" });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });
});

describe("start_module for Competitions", () => {
  it("is refused until the spotlight exists", async () => {
    const host = await createHost(["A"]);

    const response = await setFlow(host, {
      type: "start_module",
      module: "competitions",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });
});

describe("update_competitions without the right key", () => {
  async function expectRefused(host: Host, link: HostLink) {
    const response = await update(host, { type: "add", name: "Sneaky" }, link);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await namesOf(host)).toEqual(["A"]);
  }

  it("refuses a wrong key", async () => {
    const host = await createHost(["A"]);
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([
      createHost(["A"]),
      createHost(["A"]),
    ]);
    await expectRefused(host, { code: host.code, key: other.key });
  });

  it("refuses an unknown code", async () => {
    const host = await createHost(["A"]);
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("answers a wrong key and an unknown code the same", async () => {
    const host = await createHost(["A"]);
    const wrongKey = await update(
      host,
      { type: "add", name: "B" },
      { code: host.code, key: otherKey(host.key) },
    );
    const unknown = await update(
      host,
      { type: "add", name: "B" },
      { code: unusedCode(), key: host.key },
    );
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses a caller who is not signed in", async () => {
    const host = await createHost(["A"]);
    const response = await callHostActions({
      action: "update_competitions",
      code: host.code,
      key: host.key,
      change: { type: "add", name: "Sneaky" },
    });
    expect(response.status).toBe(401);
    expect(await namesOf(host)).toEqual(["A"]);
  });

  it("refuses an expired event", async () => {
    const host = await createHost(["A"]);
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );
    const response = await update(host, { type: "add", name: "B" });
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("rate limit on update_competitions", () => {
  const limit = 20;

  it(`allows ${limit} changes per user and event, then refuses`, async () => {
    const host = await createHost(["A"]);
    const [first] = await listOf(host);
    for (let i = 0; i < limit; i++) {
      expect(
        (await update(host, { type: "rename", id: first?.id, name: `A${i}` }))
          .status,
      ).toBe(200);
    }

    const response = await update(host, {
      type: "rename",
      id: first?.id,
      name: "Late",
    });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await namesOf(host)).toEqual([`A${limit - 1}`]);
  });
});
