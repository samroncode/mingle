// Lucky wheel spec (#292), ticket #295: host-actions `spin_wheel`,
// `set_wheel_auto_take_off` and `clear_wheel_spins`. Called over HTTP through
// `supabase functions serve`; the spins are read back through the host's
// normal client.
import { describe, expect, it } from "vitest";
import { anonymousUser, anonymousUsers, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & {
  user: User;
  eventId: string;
  guests: User[];
};

async function act(
  host: Host,
  action: string,
  extra: object = {},
  link: HostLink = host,
) {
  return callHostActions(
    { action, code: link.code, key: link.key, ...extra },
    { user: host.user },
  );
}

/**
 * Creates an event with the wheel on, `entries` custom entries on it, and
 * the wheel running.
 */
async function createHost(
  entries = 3,
  enabledModules: string[] = ["wheel"],
  start = true,
): Promise<Host> {
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
  const guests = await anonymousUsers(1);
  const host: Host = { ...link, user, eventId, guests };
  for (let i = 0; i < entries; i++) {
    const added = await act(host, "update_wheel", {
      change: { type: "add_custom", label: `Entry ${i + 1}` },
    });
    expect(added.status).toBe(200);
  }
  if (start) {
    const started = await setFlow(host, {
      type: "start_module",
      module: "wheel",
    });
    expect(started.status).toBe(200);
  }
  return host;
}

async function spinsOf(
  host: Host,
): Promise<{ number: number; label: string }[]> {
  const { data, error } = await host.user.client
    .from("wheel_spins")
    .select("number, label")
    .eq("event_id", host.eventId)
    .order("number");
  if (error) throw error;
  return data;
}

async function statesOf(host: Host): Promise<string[]> {
  const { data, error } = await host.user.client
    .from("wheel_entries")
    .select("state")
    .eq("event_id", host.eventId)
    .order("position");
  if (error) throw error;
  return data.map((row) => row.state);
}

describe("spin_wheel with the right key", () => {
  it("draws a winner, stores the spin and answers {}", async () => {
    const host = await createHost();
    const response = await act(host, "spin_wheel");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    const spins = await spinsOf(host);
    expect(spins).toHaveLength(1);
    expect(spins[0]?.number).toBe(1);
    expect(spins[0]?.label).toMatch(/^Entry [123]$/);
    expect(await statesOf(host)).toEqual(["on", "on", "on"]);
  });

  it("takes each winner off when the setting is on, until one entry is left", async () => {
    const host = await createHost();
    const set = await act(host, "set_wheel_auto_take_off", { enabled: true });
    expect(set.status).toBe(200);
    expect(set.body).toEqual({});

    expect((await act(host, "spin_wheel")).status).toBe(200);
    expect((await act(host, "spin_wheel")).status).toBe(200);
    expect((await statesOf(host)).filter((s) => s === "off")).toHaveLength(2);
    expect(new Set((await spinsOf(host)).map((s) => s.label)).size).toBe(2);

    const last = await act(host, "spin_wheel");
    expect(last.status).toBe(409);
    expect(last.body).toEqual({ error: "not_enough_entries" });
    expect(await spinsOf(host)).toHaveLength(2);
  });

  it("answers not_enough_entries with fewer than two entries on the wheel", async () => {
    const host = await createHost(1);
    const response = await act(host, "spin_wheel");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "not_enough_entries" });
    expect(await spinsOf(host)).toEqual([]);
  });

  it("answers invalid_transition when the wheel isn't running", async () => {
    const host = await createHost(3, ["wheel"], false);
    const idle = await act(host, "spin_wheel");
    expect(idle.status).toBe(409);
    expect(idle.body).toEqual({ error: "invalid_transition" });

    await setFlow(host, { type: "start_module", module: "wheel" });
    await setFlow(host, { type: "stop_module" });
    const stopped = await act(host, "spin_wheel");
    expect(stopped.body).toEqual({ error: "invalid_transition" });

    await setFlow(host, { type: "end_event" });
    const ended = await act(host, "spin_wheel");
    expect(ended.body).toEqual({ error: "invalid_transition" });
    expect(await spinsOf(host)).toEqual([]);
  });

  it("answers invalid_transition while another activity runs", async () => {
    const host = await createHost(3, ["wheel", "hottakes"], false);
    await setFlow(host, { type: "start_module", module: "hottakes" });
    // Hot takes without any take refuses to start; the wheel isn't running.
    const response = await act(host, "spin_wheel");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });

  it("answers module_disabled while the wheel is switched off", async () => {
    const host = await createHost(3, ["wheel", "quiz"]);
    await setFlow(host, { type: "stop_module" });
    await act(host, "set_modules", { modules: ["quiz"] });
    const spin = await act(host, "spin_wheel");
    expect(spin.status).toBe(409);
    expect(spin.body).toEqual({ error: "module_disabled" });
    const set = await act(host, "set_wheel_auto_take_off", { enabled: true });
    expect(set.body).toEqual({ error: "module_disabled" });
    const clear = await act(host, "clear_wheel_spins");
    expect(clear.body).toEqual({ error: "module_disabled" });
  });
});

describe("clear_wheel_spins", () => {
  it("empties the list and keeps the entries", async () => {
    const host = await createHost();
    await act(host, "spin_wheel");
    await act(host, "spin_wheel");

    const response = await act(host, "clear_wheel_spins");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await spinsOf(host)).toEqual([]);
    expect(await statesOf(host)).toEqual(["on", "on", "on"]);
  });

  it("answers invalid_transition once the evening has ended", async () => {
    const host = await createHost();
    await act(host, "spin_wheel");
    await setFlow(host, { type: "end_event" });
    const response = await act(host, "clear_wheel_spins");
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await spinsOf(host)).toHaveLength(1);
  });
});

describe("set_wheel_auto_take_off", () => {
  it("refuses a value that isn't a boolean", async () => {
    const host = await createHost();
    for (const enabled of ["yes", 1, null, undefined]) {
      const response = await act(host, "set_wheel_auto_take_off", { enabled });
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
  });

  it("switches off again and spins keep every entry on the wheel", async () => {
    const host = await createHost();
    await act(host, "set_wheel_auto_take_off", { enabled: true });
    await act(host, "set_wheel_auto_take_off", { enabled: false });
    await act(host, "spin_wheel");
    expect(await statesOf(host)).toEqual(["on", "on", "on"]);
  });
});

const actions: [string, object][] = [
  ["spin_wheel", {}],
  ["set_wheel_auto_take_off", { enabled: true }],
  ["clear_wheel_spins", {}],
];

describe.each(actions)("%s without the right key", (action, extra) => {
  async function expectRefused(host: Host, link: HostLink) {
    const response = await act(host, action, extra, link);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await spinsOf(host)).toEqual([]);
    const [flag] = sql(
      `select wheel_auto_take_off from public.events where id = '${host.eventId}'`,
    );
    expect(flag).toBe("f");
  }

  it("refuses a wrong key", async () => {
    const host = await createHost();
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createHost(), createHost()]);
    await expectRefused(host, { code: host.code, key: other.key });
  });

  it("refuses an unknown code, the same as a wrong key", async () => {
    const host = await createHost();
    const wrongKey = await act(host, action, extra, {
      code: host.code,
      key: otherKey(host.key),
    });
    const unknown = await act(host, action, extra, {
      code: unusedCode(),
      key: host.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("refuses a guest with a wrong key and a caller who isn't signed in", async () => {
    const host = await createHost();
    const guest = host.guests[0] as User;
    const asGuest = await callHostActions(
      { action, code: host.code, key: otherKey(host.key), ...extra },
      { user: guest },
    );
    expect(asGuest.status).toBe(403);
    const anonymous = await callHostActions({
      action,
      code: host.code,
      key: host.key,
      ...extra,
    });
    expect(anonymous.status).toBe(401);
    expect(await spinsOf(host)).toEqual([]);
  });

  it("refuses an expired event", async () => {
    const host = await createHost();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );
    const response = await act(host, action, extra);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("rate limit on spin_wheel", () => {
  const limit = 20;

  it(`allows ${limit} spins per user and event, then refuses`, async () => {
    const host = await createHost();
    for (let i = 0; i < limit; i++) {
      expect((await act(host, "spin_wheel")).status).toBe(200);
    }

    const response = await act(host, "spin_wheel");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await spinsOf(host)).toHaveLength(limit);
  });
});
