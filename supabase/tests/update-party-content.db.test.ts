// #19: host-actions `update_party_content`, the host replacing the party
// screen's content. Called over HTTP through `supabase functions serve`; the
// content is read back through the normal client, as members read it.
import { describe, expect, it } from "vitest";
import { anonymousUser, signedOutClient, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User };

const original = {
  welcome: "Välkomna!",
  menu: ["Pizza"],
};

const updated = {
  welcome: "Welcome to the afterwork",
  menu: ["Tacos", "Salad"],
  schedule: [
    { time: "18:00", title: "Drinks" },
    { time: "19:30", title: "Quiz" },
  ],
  wifi: { ssid: "Office", password: "secret123" },
  musicUrl: "https://open.spotify.com/playlist/abc",
};

/** Creates an event through host-actions, as the wizard does. */
async function createEvent(party: object = original): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz"],
      party,
    },
    { user },
  );
  expect(response.status).toBe(200);
  return { ...(response.body as HostLink), user };
}

function updateParty(
  host: Host,
  party: unknown,
  link: HostLink = host,
  user: User = host.user,
) {
  return callHostActions(
    { action: "update_party_content", code: link.code, key: link.key, party },
    { user },
  );
}

/** The event's party content, as `user` reads it through the client. */
async function partyAs(user: User, code: string): Promise<unknown> {
  const { data, error } = await user.client
    .from("events")
    .select("party")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return data?.party;
}

async function joinAs(role: "guest" | "tv", code: string): Promise<User> {
  const user = await anonymousUser();
  const { error } =
    role === "guest"
      ? await user.client.rpc("join_event", { code, display_name: "Anna" })
      : await user.client.rpc("join_tv", { code });
  if (error) throw error;
  return user;
}

describe("update_party_content with the right key", () => {
  it("replaces the party content and answers {}", async () => {
    const host = await createEvent();

    const response = await updateParty(host, updated);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await partyAs(host.user, host.code)).toEqual(updated);
  });

  it("drops the parts the new content leaves out", async () => {
    const host = await createEvent(updated);

    const response = await updateParty(host, { welcome: "Only this" });

    expect(response.status).toBe(200);
    expect(await partyAs(host.user, host.code)).toEqual({
      welcome: "Only this",
    });
  });

  it("clears everything with empty content", async () => {
    const host = await createEvent(updated);

    expect((await updateParty(host, {})).status).toBe(200);
    expect(await partyAs(host.user, host.code)).toEqual({});
  });

  it("works for a co-host who claimed the host link", async () => {
    const host = await createEvent();
    const coHost = await anonymousUser();
    await callHostActions(
      { action: "claim_host", code: host.code, key: host.key },
      { user: coHost },
    );

    const response = await updateParty(host, updated, host, coHost);

    expect(response.status).toBe(200);
    expect(await partyAs(host.user, host.code)).toEqual(updated);
  });

  it("works while an activity is running", async () => {
    const host = await createEvent();
    await callHostActions(
      {
        action: "set_flow",
        code: host.code,
        key: host.key,
        move: { type: "start_module", module: "quiz" },
      },
      { user: host.user },
    );

    expect((await updateParty(host, updated)).status).toBe(200);
    expect(await partyAs(host.user, host.code)).toEqual(updated);
  });

  it("stores winners and the hidden flag", async () => {
    const host = await createEvent();
    const party = {
      ...updated,
      winners: [{ title: "Dart tournament", name: "Anna" }],
      winnersHidden: true,
    };

    expect((await updateParty(host, party)).status).toBe(200);
    expect(await partyAs(host.user, host.code)).toEqual(party);
  });

  it("never returns the key", async () => {
    const host = await createEvent();
    const response = await updateParty(host, updated);

    expect(response.text).not.toContain(host.key);
  });
});

describe("update_party_content: who reads the new content", () => {
  it.each(["guest", "tv"] as const)(
    "the %s reads it through the normal client",
    async (role) => {
      const host = await createEvent();
      const member = await joinAs(role, host.code);

      await updateParty(host, updated);

      expect(await partyAs(member, host.code)).toEqual(updated);
    },
  );

  it("a signed-in non-member still reads nothing", async () => {
    const host = await createEvent();
    const outsider = await anonymousUser();

    await updateParty(host, updated);

    expect(await partyAs(outsider, host.code)).toBeUndefined();
  });

  it("a signed-out client still reads nothing", async () => {
    const host = await createEvent();
    await updateParty(host, updated);

    const { data } = await signedOutClient()
      .from("events")
      .select("party")
      .eq("code", host.code);
    expect(data ?? []).toEqual([]);
  });
});

describe("update_party_content: invalid content", () => {
  it.each<[string, unknown]>([
    ["an unknown field", { ...original, theme: "dark" }],
    ["an empty welcome", { welcome: "   " }],
    ["a welcome that is too long", { welcome: "x".repeat(501) }],
    ["too many menu items", { menu: Array.from({ length: 21 }, () => "Dish") }],
    [
      "a schedule time that isn't a time",
      { schedule: [{ time: "25:00", title: "Late" }] },
    ],
    ["wifi without a network name", { wifi: { password: "x" } }],
    ["a music link that isn't https", { musicUrl: "http://example.com/x" }],
    ["a music link with a script scheme", { musicUrl: "javascript:alert(1)" }],
    [
      "more than 8 winners",
      { winners: Array.from({ length: 9 }, () => ({ title: "T", name: "N" })) },
    ],
    [
      "a winner with an empty name",
      { winners: [{ title: "Darts", name: " " }] },
    ],
    [
      "a winner with an empty title",
      { winners: [{ title: "", name: "Anna" }] },
    ],
    [
      "a winner name that is too long",
      { winners: [{ title: "Darts", name: "x".repeat(41) }] },
    ],
    [
      "a winner title that is too long",
      { winners: [{ title: "x".repeat(41), name: "Anna" }] },
    ],
    ["content that isn't an object", ["Välkomna!"]],
    ["no content at all", undefined],
  ])(
    "refuses %s with invalid_request and changes nothing",
    async (_, party) => {
      const host = await createEvent();

      const response = await updateParty(host, party);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
      expect(await partyAs(host.user, host.code)).toEqual(original);
    },
  );

  it("refuses a flow field set alongside the content", async () => {
    const host = await createEvent();
    const response = await callHostActions(
      {
        action: "update_party_content",
        code: host.code,
        key: host.key,
        party: updated,
        status: "ended",
      },
      { user: host.user },
    );

    expect(response.status).toBe(400);
    expect(await partyAs(host.user, host.code)).toEqual(original);
  });
});

describe("update_party_content without the right key", () => {
  async function expectRefused(host: Host, link: HostLink, user?: User) {
    const response = await updateParty(host, updated, link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await partyAs(host.user, host.code)).toEqual(original);
  }

  it("refuses a wrong key", async () => {
    const host = await createEvent();
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createEvent(), createEvent()]);
    await expectRefused(host, { code: host.code, key: other.key });
    expect(await partyAs(other.user, other.code)).toEqual(original);
  });

  it("refuses an unknown code", async () => {
    const host = await createEvent();
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("refuses a guest of the event who has no key", async () => {
    const host = await createEvent();
    const guest = await joinAs("guest", host.code);
    await expectRefused(
      host,
      { code: host.code, key: otherKey(host.key) },
      guest,
    );
  });
});

describe("update_party_content after the event", () => {
  it("refuses an ended event with invalid_transition and changes nothing", async () => {
    const host = await createEvent();
    await callHostActions(
      {
        action: "set_flow",
        code: host.code,
        key: host.key,
        move: { type: "end_event" },
      },
      { user: host.user },
    );

    const response = await updateParty(host, updated);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await partyAs(host.user, host.code)).toEqual(original);
  });

  it("refuses an expired event with not_authorized and changes nothing", async () => {
    const host = await createEvent();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where code = '${host.code}'`,
    );

    const response = await updateParty(host, updated);

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    const [stored = ""] = sql(
      `select party from public.events where code = '${host.code}'`,
    );
    expect(JSON.parse(stored)).toEqual(original);
  });
});

describe("rate limit on update_party_content", () => {
  const limit = 10;

  it(`allows ${limit} updates per user and event, then refuses`, async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) {
      expect((await updateParty(host, original)).status).toBe(200);
    }

    const response = await updateParty(host, updated);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await partyAs(host.user, host.code)).toEqual(original);
  });

  it("counts each event on its own", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await updateParty(host, original);
    const second = await createEvent();

    const response = await updateParty(second, updated, second, host.user);

    expect(response.status).toBe(200);
  });

  it("counts each user on its own", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await updateParty(host, original);
    const coHost = await anonymousUser();

    expect((await updateParty(host, updated, host, coHost)).status).toBe(200);
  });

  it("allows updates again once the window has passed", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await updateParty(host, original);
    sql(
      `update private.rate_limits set window_start = window_start - interval '61 seconds' ` +
        `where user_id = '${host.user.id}' and action like 'update_party_content:%'`,
    );

    expect((await updateParty(host, updated)).status).toBe(200);
  });
});

describe("the party content outside host-actions", () => {
  it.each(["guest", "tv", "host"] as const)(
    "the %s can't change it directly",
    async (role) => {
      const host = await createEvent();
      const member =
        role === "host" ? host.user : await joinAs(role, host.code);

      const { error } = await member.client
        .from("events")
        .update({ party: updated })
        .eq("code", host.code);

      expect(error).not.toBeNull();
      expect(await partyAs(host.user, host.code)).toEqual(original);
    },
  );

  it("no client role can call update_event_party", async () => {
    const host = await createEvent();
    const [eventId = ""] = sql(
      `select id from public.events where code = '${host.code}'`,
    );
    for (const client of [host.user.client, signedOutClient()]) {
      const { error } = await client.rpc("update_event_party", {
        target_event_id: eventId,
        party: updated,
      });
      expect(error?.code).toBe("42501");
    }
    expect(await partyAs(host.user, host.code)).toEqual(original);
  });
});
