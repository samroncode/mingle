// Awards spec (#59), ticket #66: host-actions `update_awards`, the host
// replacing the unrevealed award categories during the evening. Called over
// HTTP through `supabase functions serve`; the categories are read back
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
type Category = { text: string };

function categories(count: number, prefix = "Most likely to"): Category[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `${prefix} ${i + 1}`,
  }));
}

/** Creates an event with `count` award categories through host-actions. */
async function createAwards(
  count: number,
  enabledModules: string[] = ["awards", "quiz"],
): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules,
      party: {},
      ...(count > 0 ? { awards: categories(count) } : {}),
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

function updateAwards(
  host: Host,
  list: unknown,
  link: HostLink = host,
  user: User = host.user,
) {
  return callHostActions(
    {
      action: "update_awards",
      code: link.code,
      key: link.key,
      categories: list,
    },
    { user },
  );
}

const startAwards: Move = { type: "start_module", module: "awards" };
const open: Move = { type: "open" };
const reveal: Move = { type: "reveal" };
const next: Move = { type: "next_step" };
const stop: Move = { type: "stop_module" };
const play: Move[] = [open, reveal, next];

type Stored = Category & { position: number; revealedAt: string | null };

/** The event's categories in order, as the host reads them. */
async function awardsOf(host: Host): Promise<Stored[]> {
  const { data, error } = await host.user.client
    .from("award_categories")
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

async function textsOf(host: Host): Promise<Category[]> {
  return (await awardsOf(host)).map(({ text }) => ({ text }));
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

describe("update_awards before the awards start", () => {
  it("replaces every category in the order sent and answers {}", async () => {
    const host = await createAwards(3);
    const list = categories(4, "New");

    const response = await updateAwards(host, list);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect((await awardsOf(host)).map((c) => c.position)).toEqual([0, 1, 2, 3]);
    expect(await textsOf(host)).toEqual(list);
  });

  it("removes every category with an empty list", async () => {
    const host = await createAwards(3);

    expect((await updateAwards(host, [])).status).toBe(200);
    expect(await awardsOf(host)).toEqual([]);
  });

  it("adds categories to an event that had none", async () => {
    const host = await createAwards(0);

    expect((await updateAwards(host, categories(2))).status).toBe(200);
    expect(await textsOf(host)).toEqual(categories(2));
  });

  it("takes 20 categories", async () => {
    const host = await createAwards(1);

    expect((await updateAwards(host, categories(20))).status).toBe(200);
    expect(await awardsOf(host)).toHaveLength(20);
  });

  it("refuses more than 20 with invalid_request and changes nothing", async () => {
    const host = await createAwards(3);

    const response = await updateAwards(host, categories(21));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(categories(3));
  });

  it("never returns the key", async () => {
    const host = await createAwards(1);
    expect((await updateAwards(host, categories(2))).text).not.toContain(
      host.key,
    );
  });
});

describe("update_awards after some categories are revealed", () => {
  it("keeps the revealed categories and replaces the rest after them", async () => {
    const host = await createAwards(4);
    await moves(host, startAwards, ...play, ...play, stop);
    const before = await awardsOf(host);
    const list = categories(3, "New");

    const response = await updateAwards(host, list);

    expect(response.status).toBe(200);
    const after = await awardsOf(host);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    expect(after.slice(2).map((c) => c.position)).toEqual([2, 3, 4]);
    expect((await textsOf(host)).slice(2)).toEqual(list);
    expect(after.slice(2).every((c) => c.revealedAt === null)).toBe(true);
  });

  it("works between categories while the awards run, and they go on at the first new one", async () => {
    const host = await createAwards(3);
    await moves(host, startAwards, ...play);

    expect((await updateAwards(host, categories(2, "New"))).status).toBe(200);

    expect(await stepOf(host)).toBe(1);
    await moves(host, open);
    const { data } = await host.user.client
      .from("award_categories")
      .select("text")
      .eq("event_id", host.eventId)
      .eq("position", 1)
      .single();
    expect(data?.text).toBe("New 1");
  });

  it("works on the party screen while the awards are stopped", async () => {
    const host = await createAwards(2);
    await moves(host, startAwards, ...play, stop);

    expect((await updateAwards(host, categories(1, "New"))).status).toBe(200);
    await moves(host, startAwards);
    expect(await stepOf(host)).toBe(1);
  });

  it("puts a skipped category's revealed neighbours first, so steps stay in order", async () => {
    const host = await createAwards(3);
    // Skips category 1, reveals category 2.
    await moves(host, startAwards, next, ...play, stop);

    expect((await updateAwards(host, categories(1, "New"))).status).toBe(200);

    const after = await awardsOf(host);
    expect(after.map((c) => [c.position, c.text])).toEqual([
      [0, "Most likely to 2"],
      [1, "New 1"],
    ]);
    expect(after[0]?.revealedAt).not.toBeNull();
    await moves(host, startAwards);
    expect(await stepOf(host)).toBe(1);
  });

  it("keeps the votes on revealed categories, so the winners stay the same", async () => {
    const host = await createAwards(2);
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
    await moves(host, startAwards, open);
    const [categoryId = ""] = sql(
      `select id from public.award_categories ` +
        `where event_id = '${host.eventId}' and position = 0`,
    );
    const vote = await anna.client.from("award_votes").insert({
      category_id: categoryId,
      event_id: host.eventId,
      voter_id: anna.id,
      voted_for_id: bob.id,
    });
    expect(vote.error).toBeNull();
    await moves(host, reveal, next);

    expect((await updateAwards(host, categories(2, "New"))).status).toBe(200);

    const { data } = await host.user.client.rpc("award_winners", {
      target_category_id: categoryId,
    });
    expect(data?.map((row) => row.user_id)).toEqual([bob.id]);
  });

  it("counts the revealed categories in the limit of 20", async () => {
    const host = await createAwards(3);
    await moves(host, startAwards, ...play, ...play, stop);

    const over = await updateAwards(host, categories(19));
    expect(over.status).toBe(400);
    expect(over.body).toEqual({ error: "invalid_request" });
    expect(await awardsOf(host)).toHaveLength(3);

    expect((await updateAwards(host, categories(18))).status).toBe(200);
    expect(await awardsOf(host)).toHaveLength(20);
  });
});

describe("update_awards refused by the flow", () => {
  async function expectRefused(host: Host, error = "invalid_transition") {
    const before = await awardsOf(host);
    const response = await updateAwards(host, categories(2, "New"));
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error });
    expect(await awardsOf(host)).toEqual(before);
  }

  it("refuses while a category is open", async () => {
    const host = await createAwards(3);
    await moves(host, startAwards, open);
    await expectRefused(host);
  });

  it("refuses while a category is revealed", async () => {
    const host = await createAwards(3);
    await moves(host, startAwards, open, reveal);
    await expectRefused(host);
  });

  it("refuses once the event has ended", async () => {
    const host = await createAwards(3);
    await moves(host, { type: "end_event" });
    await expectRefused(host);
  });

  it("refuses once every category is revealed, so the awards stay finished", async () => {
    const host = await createAwards(2);
    await moves(host, startAwards, ...play, ...play);
    await expectRefused(host);
    await moves(host, stop);
    await expectRefused(host);
  });

  it("refuses categories for an event with the awards switched off", async () => {
    const host = await createAwards(0, ["quiz"]);
    await expectRefused(host, "module_disabled");
  });

  it("a flow move after the update is checked against the new state", async () => {
    const host = await createAwards(3);
    await moves(host, startAwards, next);
    await updateAwards(host, categories(2, "New"));

    // The awards moved back to step 0, the first new category.
    expect(await stepOf(host)).toBe(0);
    expect((await setFlow(host, open)).status).toBe(200);
  });
});

describe("update_awards: invalid categories", () => {
  it.each<[string, unknown]>([
    ["an empty category", [{ text: "  " }]],
    ["a category that is too long", [{ text: "x".repeat(121) }]],
    ["an unknown field", [{ text: "Most likely to", revealed: true }]],
    ["categories that aren't a list", { text: "Most likely to" }],
    ["no categories at all", undefined],
  ])("refuses %s with invalid_request and changes nothing", async (_, list) => {
    const host = await createAwards(2);

    const response = await updateAwards(host, list);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(categories(2));
  });
});

describe("update_awards without the right key", () => {
  async function expectRefused(host: Host, link: HostLink, user?: User) {
    const response = await updateAwards(host, categories(1, "New"), link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await textsOf(host)).toEqual(categories(2));
  }

  it("refuses a wrong key", async () => {
    const host = await createAwards(2);
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createAwards(2), createAwards(2)]);
    await expectRefused(host, { code: host.code, key: other.key });
    expect(await textsOf(other)).toEqual(categories(2));
  });

  it("refuses an unknown code", async () => {
    const host = await createAwards(2);
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("answers a wrong key and an unknown code the same", async () => {
    const host = await createAwards(2);
    const wrongKey = await updateAwards(host, categories(1), {
      code: host.code,
      key: otherKey(host.key),
    });
    const unknown = await updateAwards(host, categories(1), {
      code: unusedCode(),
      key: host.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses an expired event", async () => {
    const host = await createAwards(2);
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );

    const response = await updateAwards(host, categories(1, "New"));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(
      sql(
        `select text from public.award_categories ` +
          `where event_id = '${host.eventId}' order by position`,
      ),
    ).toEqual(["Most likely to 1", "Most likely to 2"]);
  });
});

describe("rate limit on update_awards", () => {
  const limit = 10;

  it(`allows ${limit} updates per user and event, then refuses`, async () => {
    const host = await createAwards(2);
    for (let i = 0; i < limit; i++) {
      expect((await updateAwards(host, categories(2))).status).toBe(200);
    }

    const response = await updateAwards(host, categories(1, "New"));

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await textsOf(host)).toEqual(categories(2));
  });

  it("counts under update_awards and the event's id, after the key check", async () => {
    const host = await createAwards(2);
    await updateAwards(host, categories(2), {
      code: host.code,
      key: otherKey(host.key),
    });
    await updateAwards(host, categories(2));

    expect(
      sql(
        `select action, count from private.rate_limits ` +
          `where user_id = '${host.user.id}' and action like 'update_awards%'`,
      ),
    ).toEqual([`update_awards:${host.eventId}|1`]);
  });

  it("counts each event on its own", async () => {
    const host = await createAwards(2);
    for (let i = 0; i < limit; i++) await updateAwards(host, categories(2));
    const second = await createAwards(2);

    const response = await updateAwards(
      second,
      categories(1),
      second,
      host.user,
    );

    expect(response.status).toBe(200);
  });
});

describe("update_award_categories outside host-actions", () => {
  it("no client role can call it", async () => {
    const host = await createAwards(2);
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
      const { error } = await client.rpc("update_award_categories", {
        target_event_id: host.eventId,
        categories: categories(1, "New"),
      });
      expect(error?.code).toBe("42501");
    }
    expect(await textsOf(host)).toEqual(categories(2));
  });

  it("the service role can call it", async () => {
    const host = await createAwards(2);

    const { data, error } = await serviceClient().rpc(
      "update_award_categories",
      { target_event_id: host.eventId, categories: [{ text: "Direct" }] },
    );

    expect(error).toBeNull();
    expect(data).toBe("updated");
    expect(await textsOf(host)).toEqual([{ text: "Direct" }]);
  });
});
