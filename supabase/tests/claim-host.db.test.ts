// #18: host-actions `claim_host`, and the admin key check every later host
// action reuses. Called over HTTP through `supabase functions serve`.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  randomCode,
  signedOutClient,
  sql,
  type User,
} from "./helpers";
import { callHostActions } from "./functions";

type HostLink = { code: string; key: string };

/** Creates an event through host-actions, as the wizard does. */
async function createEvent(host?: User): Promise<HostLink> {
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: [],
      party: {},
    },
    { user: host ?? (await anonymousUser()) },
  );
  expect(response.status).toBe(200);
  return response.body as HostLink;
}

function claim(user: User, link: HostLink) {
  return callHostActions(
    { action: "claim_host", code: link.code, key: link.key },
    { user },
  );
}

describe("claim_host with the right key", () => {
  it("makes the caller a host who can read the event and its members", async () => {
    const original = await anonymousUser();
    const link = await createEvent(original);
    const device = await anonymousUser();

    const response = await claim(device, link);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    const { data: events } = await device.client.from("events").select();
    expect(events).toEqual([expect.objectContaining({ code: link.code })]);
    const { data: members } = await device.client.from("members").select();
    expect(members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: original.id, role: "host" }),
        expect.objectContaining({ user_id: device.id, role: "host" }),
      ]),
    );
    expect(members).toHaveLength(2);
  });

  it("is harmless to repeat and leaves one member row", async () => {
    const link = await createEvent();
    const device = await anonymousUser();

    expect((await claim(device, link)).status).toBe(200);
    expect((await claim(device, link)).status).toBe(200);

    const { data: members } = await device.client
      .from("members")
      .select()
      .eq("user_id", device.id);
    expect(members).toEqual([expect.objectContaining({ role: "host" })]);
  });

  it("leaves the creator a host when they claim their own event", async () => {
    const original = await anonymousUser();
    const link = await createEvent(original);

    expect((await claim(original, link)).status).toBe(200);

    const { data: members } = await original.client.from("members").select();
    expect(members).toEqual([
      expect.objectContaining({ user_id: original.id, role: "host" }),
    ]);
  });

  it("turns a guest of the event into a host in the same row, without a name", async () => {
    const link = await createEvent();
    const [guest, other] = await anonymousUsers(2);
    await guest.client.rpc("join_event", {
      code: link.code,
      display_name: "Anna",
    });

    expect((await claim(guest, link)).status).toBe(200);

    const { data: rows } = await guest.client
      .from("members")
      .select()
      .eq("user_id", guest.id);
    expect(rows).toEqual([
      expect.objectContaining({ role: "host", display_name: null }),
    ]);

    // A host has no name, so Anna is free for another guest.
    const { data: joined } = await other.client.rpc("join_event", {
      code: link.code,
      display_name: "Anna",
    });
    expect(joined).toMatchObject({ error: null });
  });

  it("turns the TV of the event into a host in the same row", async () => {
    const link = await createEvent();
    const tv = await anonymousUser();
    await tv.client.rpc("join_tv", { code: link.code });

    expect((await claim(tv, link)).status).toBe(200);

    const { data: rows } = await tv.client
      .from("members")
      .select()
      .eq("user_id", tv.id);
    expect(rows).toEqual([
      expect.objectContaining({ role: "host", display_name: null }),
    ]);
  });

  it("never returns the key", async () => {
    const link = await createEvent();
    const response = await claim(await anonymousUser(), link);

    expect(response.text).not.toContain(link.key);
  });
});

describe("claim_host without the right key", () => {
  /** The same refusal for every case, so it reveals nothing. */
  async function expectRefused(user: User, body: Record<string, unknown>) {
    const response = await callHostActions(
      { action: "claim_host", ...body },
      { user },
    );
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    const { data: events } = await user.client.from("events").select();
    expect(events).toEqual([]);
  }

  it("refuses a wrong key", async () => {
    const link = await createEvent();
    await expectRefused(await anonymousUser(), {
      code: link.code,
      key: otherKey(link.key),
    });
  });

  it("refuses the key of another event", async () => {
    const [link, other] = await Promise.all([createEvent(), createEvent()]);
    await expectRefused(await anonymousUser(), {
      code: link.code,
      key: other.key,
    });
  });

  it("refuses an unknown code", async () => {
    const link = await createEvent();
    await expectRefused(await anonymousUser(), {
      code: unusedCode(),
      key: link.key,
    });
  });

  it("refuses the right key once the event has expired", async () => {
    const link = await createEvent();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where code = '${link.code}'`,
    );
    await expectRefused(await anonymousUser(), link);
  });

  it("doesn't let a guest of the event become host", async () => {
    const link = await createEvent();
    const guest = await anonymousUser();
    await guest.client.rpc("join_event", {
      code: link.code,
      display_name: "Anna",
    });

    const response = await claim(guest, { ...link, key: otherKey(link.key) });

    expect(response.status).toBe(403);
    const { data: rows } = await guest.client
      .from("members")
      .select()
      .eq("user_id", guest.id);
    expect(rows).toEqual([
      expect.objectContaining({ role: "guest", display_name: "Anna" }),
    ]);
  });

  it.each([
    ["no key", (link: HostLink) => ({ code: link.code })],
    ["a key of the wrong shape", (link: HostLink) => ({ ...link, key: "x" })],
    [
      "a code of the wrong shape",
      (link: HostLink) => ({ ...link, code: "abc" }),
    ],
    ["an unknown field", (link: HostLink) => ({ ...link, role: "host" })],
  ])("refuses %s with invalid_request", async (_, body) => {
    const link = await createEvent();
    const response = await callHostActions(
      { action: "claim_host", ...body(link) },
      { user: await anonymousUser() },
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});

describe("rate limit on failed key checks", () => {
  it("allows ten failures per user, then refuses even the right key", async () => {
    const link = await createEvent();
    const attacker = await anonymousUser();
    const wrong = { ...link, key: otherKey(link.key) };
    for (let i = 0; i < 10; i++) {
      expect((await claim(attacker, wrong)).status).toBe(403);
    }

    const response = await claim(attacker, link);
    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    const { data: events } = await attacker.client.from("events").select();
    expect(events).toEqual([]);

    // Another user isn't affected.
    expect((await claim(await anonymousUser(), link)).status).toBe(200);
  });

  it("doesn't count successful claims", async () => {
    const link = await createEvent();
    const host = await anonymousUser();
    for (let i = 0; i < 11; i++) {
      expect((await claim(host, link)).status).toBe(200);
    }
  });

  it("allows key checks again once the window has passed", async () => {
    const link = await createEvent();
    const user = await anonymousUser();
    const wrong = { ...link, key: otherKey(link.key) };
    for (let i = 0; i < 10; i++) await claim(user, wrong);
    sql(
      `update private.rate_limits set window_start = window_start - interval '11 minutes' ` +
        `where user_id = '${user.id}' and action = 'admin_key_failure'`,
    );

    expect((await claim(user, link)).status).toBe(200);
  });
});

describe("the database calls behind the key check and claim_host", () => {
  const nobody = "00000000-0000-0000-0000-000000000000";
  const rpcs = [
    ["event_admin_key_hash", { code: "ABCDEF" }],
    [
      "rate_limit_reached",
      {
        caller: nobody,
        action: "admin_key_failure",
        max_attempts: 10,
        window_seconds: 600,
      },
    ],
    ["claim_host", { caller: nobody, target_event_id: nobody }],
  ] as const;

  it.each(rpcs)("no client role can call %s", async (name, args) => {
    const user = await anonymousUser();
    for (const client of [user.client, signedOutClient()]) {
      const { error } = await client.rpc(name, args as never);
      expect(error?.code).toBe("42501");
    }
  });
});

/** A valid-looking key that differs from `key`. */
function otherKey(key: string): string {
  return (key.startsWith("A") ? "B" : "A") + key.slice(1);
}

/** A code no event has. */
function unusedCode(): string {
  for (;;) {
    const code = randomCode();
    if (
      sql(`select 1 from public.events where code = '${code}'`).length === 0
    ) {
      return code;
    }
  }
}
