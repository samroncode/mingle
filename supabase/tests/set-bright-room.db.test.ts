// Visual design spec (#123), ticket #129: host-actions `set_bright_room`, the
// host switching the light theme on for a bright room. Called over HTTP
// through `supabase functions serve`; the flag is read back as a member.
import { describe, expect, it } from "vitest";
import { anonymousUser, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };

async function createEvent(): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: [],
      party: {},
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

function setBrightRoom(host: Host, bright: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "set_bright_room", code: link.code, key: link.key, bright },
    { user: host.user },
  );
}

async function brightOf(host: Host): Promise<boolean> {
  const { data, error } = await host.user.client
    .from("events")
    .select("bright_room")
    .eq("code", host.code)
    .single();
  if (error) throw error;
  return data.bright_room;
}

describe("set_bright_room with the right key", () => {
  it("starts off, switches on and off again, answering {}", async () => {
    const host = await createEvent();
    expect(await brightOf(host)).toBe(false);

    const on = await setBrightRoom(host, true);
    expect(on.status).toBe(200);
    expect(on.body).toEqual({});
    expect(await brightOf(host)).toBe(true);

    expect((await setBrightRoom(host, false)).status).toBe(200);
    expect(await brightOf(host)).toBe(false);
  });

  it("rejects a value that isn't a boolean", async () => {
    const host = await createEvent();

    for (const bright of ["true", 1, null]) {
      const response = await setBrightRoom(host, bright);
      expect(response.status, JSON.stringify(bright)).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await brightOf(host)).toBe(false);
  });
});

describe("set_bright_room without the right key", () => {
  it("answers a wrong key, an unknown code and another event's key alike", async () => {
    const host = await createEvent();
    const other = await createEvent();

    const answers = [
      await setBrightRoom(host, true, {
        code: host.code,
        key: otherKey(host.key),
      }),
      await setBrightRoom(host, true, { code: unusedCode(), key: host.key }),
      await setBrightRoom(host, true, { code: host.code, key: other.key }),
    ];

    for (const answer of answers) {
      expect(answer.status).toBe(answers[0]?.status);
      expect(answer.body).toEqual(answers[0]?.body);
    }
    expect(answers[0]?.body).toEqual({ error: "not_authorized" });
    expect(await brightOf(host)).toBe(false);
  });
});

describe("the bright_room flag as a client", () => {
  it("can't be written with the host's own login", async () => {
    const host = await createEvent();

    const update = await host.user.client
      .from("events")
      .update({ bright_room: true })
      .eq("code", host.code);
    const rpc = await host.user.client.rpc("set_bright_room", {
      target_event_id: host.eventId,
      bright: true,
    });

    expect(update.error).not.toBeNull();
    expect(rpc.error).not.toBeNull();
    expect(await brightOf(host)).toBe(false);
  });

  it("can't be read by someone outside the event", async () => {
    const host = await createEvent();
    const stranger = await anonymousUser();

    const { data } = await stranger.client
      .from("events")
      .select("bright_room")
      .eq("code", host.code);

    expect(data).toEqual([]);
  });
});

describe("rate limit on set_bright_room", () => {
  it("allows 10 switches per user and event, then refuses", async () => {
    const host = await createEvent();
    for (let i = 0; i < 10; i++) {
      expect((await setBrightRoom(host, i % 2 === 0)).status).toBe(200);
    }

    const response = await setBrightRoom(host, true);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
  });
});
