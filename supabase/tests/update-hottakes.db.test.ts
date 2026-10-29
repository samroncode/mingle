// Hot takes spec (#67), ticket #74: host-actions `update_hottakes`, the host
// replacing the unrevealed hot takes during the evening. Called over
// HTTP through `supabase functions serve`; the takes are read back
// through the host's normal client.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  serviceClient,
  signedOutClient,
  sql,
  type User,
} from "./helpers";
import { callHostActions } from "./functions";
import {
  moves,
  otherKey,
  setFlow,
  unusedCode,
  type HostLink,
  type Move,
} from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };
type Take = { text: string };

function takes(count: number, prefix = "Hot take"): Take[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `${prefix} ${i + 1}`,
  }));
}

/** Creates an event with `count` hot takes through host-actions. */
async function createHotTakes(
  count: number,
  enabledModules: string[] = ["hottakes", "quiz"],
): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules,
      party: {},
      ...(count > 0 ? { hottakes: takes(count) } : {}),
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

function updateHotTakes(
  host: Host,
  list: unknown,
  link: HostLink = host,
  user: User = host.user,
) {
  return callHostActions(
    {
      action: "update_hottakes",
      code: link.code,
      key: link.key,
      takes: list,
    },
    { user },
  );
}

const startHotTakes: Move = { type: "start_module", module: "hottakes" };
const open: Move = { type: "open" };
const reveal: Move = { type: "reveal" };
const next: Move = { type: "next_step" };
const stop: Move = { type: "stop_module" };
const play: Move[] = [open, reveal, next];

type Stored = Take & { position: number; revealedAt: string | null };

/** The event's takes in order, as the host reads them. */
async function takesOf(host: Host): Promise<Stored[]> {
  const { data, error } = await host.user.client
    .from("hot_takes")
    .select("position, text, revealed_at")
    .eq("event_id", host.eventId)
    .order("position");
  if (error) throw error;
  return data.map((row) => ({
    position: row.position,
    text: row.text,
    revealedAt: row.revealed_at,
  }));
}

async function textsOf(host: Host): Promise<Take[]> {
  return (await takesOf(host)).map(({ text }) => ({ text }));
}

async function stepOf(host: Host): Promise<number> {
  const { data, error } = await host.user.client
    .from("events")
    .select("current_step")
    .eq("id", host.eventId)
    .single();
  if (error) throw error;
  return data.current_step;
}

describe("update_hottakes before hot takes start", () => {
  it("replaces every hot take in the order sent and answers {}", async () => {
    const host = await createHotTakes(3);
    const list = takes(4, "New");

    const response = await updateHotTakes(host, list);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect((await takesOf(host)).map((c) => c.position)).toEqual([0, 1, 2, 3]);
    expect(await textsOf(host)).toEqual(list);
  });

  it("removes every hot take with an empty list", async () => {
    const host = await createHotTakes(3);

    expect((await updateHotTakes(host, [])).status).toBe(200);
    expect(await takesOf(host)).toEqual([]);
  });

  it("adds takes to an event that had none", async () => {
    const host = await createHotTakes(0);

    expect((await updateHotTakes(host, takes(2))).status).toBe(200);
    expect(await textsOf(host)).toEqual(takes(2));
  });

  it("takes 20 takes", async () => {
    const host = await createHotTakes(1);

    expect((await updateHotTakes(host, takes(20))).status).toBe(200);
    expect(await takesOf(host)).toHaveLength(20);
  });

  it("refuses more than 20 with invalid_request and changes nothing", async () => {
    const host = await createHotTakes(3);

    const response = await updateHotTakes(host, takes(21));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(takes(3));
  });

  it("never returns the key", async () => {
    const host = await createHotTakes(1);
    expect((await updateHotTakes(host, takes(2))).text).not.toContain(host.key);
  });
});

describe("update_hottakes after some takes are revealed", () => {
  it("keeps the revealed takes and replaces the rest after them", async () => {
    const host = await createHotTakes(4);
    await moves(host, startHotTakes, ...play, ...play, stop);
    const before = await takesOf(host);
    const list = takes(3, "New");

    const response = await updateHotTakes(host, list);

    expect(response.status).toBe(200);
    const after = await takesOf(host);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    expect(after.slice(2).map((c) => c.position)).toEqual([2, 3, 4]);
    expect((await textsOf(host)).slice(2)).toEqual(list);
    expect(after.slice(2).every((c) => c.revealedAt === null)).toBe(true);
  });

  it("works between takes while hot takes run, and they go on at the first new one", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, ...play);

    expect((await updateHotTakes(host, takes(2, "New"))).status).toBe(200);

    expect(await stepOf(host)).toBe(1);
    await moves(host, open);
    const { data } = await host.user.client
      .from("hot_takes")
      .select("text")
      .eq("event_id", host.eventId)
      .eq("position", 1)
      .single();
    expect(data?.text).toBe("New 1");
  });

  it("works on the party screen while hot takes are stopped", async () => {
    const host = await createHotTakes(2);
    await moves(host, startHotTakes, ...play, stop);

    expect((await updateHotTakes(host, takes(1, "New"))).status).toBe(200);
    await moves(host, startHotTakes);
    expect(await stepOf(host)).toBe(1);
  });

  it("puts a skipped hot take's revealed neighbours first, so steps stay in order", async () => {
    const host = await createHotTakes(3);
    // Skips hot take 1, reveals hot take 2.
    await moves(host, startHotTakes, next, ...play, stop);

    expect((await updateHotTakes(host, takes(1, "New"))).status).toBe(200);

    const after = await takesOf(host);
    expect(after.map((c) => [c.position, c.text])).toEqual([
      [0, "Hot take 2"],
      [1, "New 1"],
    ]);
    expect(after[0]?.revealedAt).not.toBeNull();
    await moves(host, startHotTakes);
    expect(await stepOf(host)).toBe(1);
  });

  it("keeps the answers to revealed hot takes, so the split stays the same", async () => {
    const host = await createHotTakes(2);
    const [anna, bob] = [await anonymousUser(), await anonymousUser()];
    for (const [guest, name] of [
      [anna, "Anna"],
      [bob, "Bob"],
    ] as const) {
      await guest.client.rpc("join_event", {
        code: host.code,
        display_name: name,
      });
    }
    await moves(host, startHotTakes, open);
    const [takeId = ""] = sql(
      `select id from public.hot_takes ` +
        `where event_id = '${host.eventId}' and position = 0`,
    );
    const answer = await anna.client.from("hot_take_answers").insert({
      hot_take_id: takeId,
      event_id: host.eventId,
      guest_id: anna.id,
      agree: true,
    });
    expect(answer.error).toBeNull();
    await moves(host, reveal, next);

    expect((await updateHotTakes(host, takes(2, "New"))).status).toBe(200);

    const { data } = await host.user.client.rpc("hot_take_result", {
      target_hot_take_id: takeId,
    });
    expect(data).toEqual([{ agree_count: 1, disagree_count: 0 }]);
  });

  it("counts the revealed takes in the limit of 20", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, ...play, ...play, stop);

    const over = await updateHotTakes(host, takes(19));
    expect(over.status).toBe(400);
    expect(over.body).toEqual({ error: "invalid_request" });
    expect(await takesOf(host)).toHaveLength(3);

    expect((await updateHotTakes(host, takes(18))).status).toBe(200);
    expect(await takesOf(host)).toHaveLength(20);
  });
});

describe("update_hottakes refused by the flow", () => {
  async function expectRefused(host: Host, error = "invalid_transition") {
    const before = await takesOf(host);
    const response = await updateHotTakes(host, takes(2, "New"));
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error });
    expect(await takesOf(host)).toEqual(before);
  }

  it("refuses while a hot take is open", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, open);
    await expectRefused(host);
  });

  it("refuses while a hot take is revealed", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, open, reveal);
    await expectRefused(host);
  });

  it("refuses once the event has ended", async () => {
    const host = await createHotTakes(3);
    await moves(host, { type: "end_event" });
    await expectRefused(host);
  });

  it("refuses once every hot take is revealed, so hot takes stay finished", async () => {
    const host = await createHotTakes(2);
    await moves(host, startHotTakes, ...play, ...play);
    await expectRefused(host);
    await moves(host, stop);
    await expectRefused(host);
  });

  it("refuses takes for an event with hot takes switched off", async () => {
    const host = await createHotTakes(0, ["quiz"]);
    await expectRefused(host, "module_disabled");
  });

  it("a flow move after the update is checked against the new state", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, next);
    await updateHotTakes(host, takes(2, "New"));

    // Hot takes moved back to step 0, the first new hot take.
    expect(await stepOf(host)).toBe(0);
    expect((await setFlow(host, open)).status).toBe(200);
  });
});

describe("update_hottakes: invalid takes", () => {
  it.each<[string, unknown]>([
    ["an empty hot take", [{ text: "  " }]],
    ["a hot take that is too long", [{ text: "x".repeat(121) }]],
    ["an unknown field", [{ text: "Hot take", revealed: true }]],
    ["takes that aren't a list", { text: "Hot take" }],
    ["no takes at all", undefined],
  ])("refuses %s with invalid_request and changes nothing", async (_, list) => {
    const host = await createHotTakes(2);

    const response = await updateHotTakes(host, list);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(takes(2));
  });
});

describe("update_hottakes without the right key", () => {
  async function expectRefused(host: Host, link: HostLink, user?: User) {
    const response = await updateHotTakes(host, takes(1, "New"), link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await textsOf(host)).toEqual(takes(2));
  }

  it("refuses a wrong key", async () => {
    const host = await createHotTakes(2);
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([
      createHotTakes(2),
      createHotTakes(2),
    ]);
    await expectRefused(host, { code: host.code, key: other.key });
    expect(await textsOf(other)).toEqual(takes(2));
  });

  it("refuses an unknown code", async () => {
    const host = await createHotTakes(2);
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("answers a wrong key and an unknown code the same", async () => {
    const host = await createHotTakes(2);
    const wrongKey = await updateHotTakes(host, takes(1), {
      code: host.code,
      key: otherKey(host.key),
    });
    const unknown = await updateHotTakes(host, takes(1), {
      code: unusedCode(),
      key: host.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses an expired event", async () => {
    const host = await createHotTakes(2);
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );

    const response = await updateHotTakes(host, takes(1, "New"));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(
      sql(
        `select text from public.hot_takes ` +
          `where event_id = '${host.eventId}' order by position`,
      ),
    ).toEqual(["Hot take 1", "Hot take 2"]);
  });
});

describe("rate limit on update_hottakes", () => {
  const limit = 10;

  it(`allows ${limit} updates per user and event, then refuses`, async () => {
    const host = await createHotTakes(2);
    for (let i = 0; i < limit; i++) {
      expect((await updateHotTakes(host, takes(2))).status).toBe(200);
    }

    const response = await updateHotTakes(host, takes(1, "New"));

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await textsOf(host)).toEqual(takes(2));
  });

  it("counts under update_hottakes and the event's id, after the key check", async () => {
    const host = await createHotTakes(2);
    await updateHotTakes(host, takes(2), {
      code: host.code,
      key: otherKey(host.key),
    });
    await updateHotTakes(host, takes(2));

    expect(
      sql(
        `select action, count from private.rate_limits ` +
          `where user_id = '${host.user.id}' and action like 'update_hottakes%'`,
      ),
    ).toEqual([`update_hottakes:${host.eventId}|1`]);
  });

  it("counts each event on its own", async () => {
    const host = await createHotTakes(2);
    for (let i = 0; i < limit; i++) await updateHotTakes(host, takes(2));
    const second = await createHotTakes(2);

    const response = await updateHotTakes(second, takes(1), second, host.user);

    expect(response.status).toBe(200);
  });
});

describe("update_hot_takes outside host-actions", () => {
  it("no client role can call it", async () => {
    const host = await createHotTakes(2);
    const [guest, tv, outsider] = [
      await anonymousUser(),
      await anonymousUser(),
      await anonymousUser(),
    ];
    await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });
    await tv.client.rpc("join_tv", { code: host.code });

    for (const client of [
      host.user.client,
      guest.client,
      tv.client,
      outsider.client,
      signedOutClient(),
    ]) {
      const { error } = await client.rpc("update_hot_takes", {
        target_event_id: host.eventId,
        takes: takes(1, "New"),
      });
      expect(error?.code).toBe("42501");
    }
    expect(await textsOf(host)).toEqual(takes(2));
  });

  it("the service role can call it", async () => {
    const host = await createHotTakes(2);

    const { data, error } = await serviceClient().rpc("update_hot_takes", {
      target_event_id: host.eventId,
      takes: [{ text: "Direct" }],
    });

    expect(error).toBeNull();
    expect(data).toBe("updated");
    expect(await textsOf(host)).toEqual([{ text: "Direct" }]);
  });
});
