// #17: host-actions `create_event`, and the checks every host action shares:
// the caller's JWT, the request schema, the body size cap, CORS and the rate
// limit. Called over HTTP through `supabase functions serve`.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  localStack,
  randomCode,
  serviceClient,
  signedOutClient,
  sql,
  type User,
} from "./helpers";
import { callHostActions, preflight } from "./functions";

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/;

const party = {
  welcome: "Välkomna!",
  menu: ["Tacos", "Glass"],
  schedule: [{ time: "19:00", title: "Middag" }],
  wifi: { ssid: "Kontoret", password: "hemligt123" },
  musicUrl: "https://open.spotify.com/playlist/abc",
};

const createEvent = {
  action: "create_event",
  niche: "aw",
  language: "sv",
  enabledModules: ["quiz", "hottakes"],
  party,
};

const question = (n: number, correct = 0) => ({
  text: `Fråga ${n}?`,
  options: ["a", "b", "c", "d"].map((o) => `${o}${n}`),
  correct,
});

/** The events the user can read, which are the ones they are a member of. */
async function eventsOf(user: User) {
  const { data, error } = await user.client.from("events").select();
  if (error) throw error;
  return data;
}

describe("create_event", () => {
  it("returns only a code and an admin key", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(createEvent, { user: host });

    expect(response.status).toBe(200);
    const body = response.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["code", "key"]);
    expect(body.code).toMatch(CODE);
    expect(body.key).toMatch(KEY);
  });

  it("makes the caller the host of an event with the wizard's data", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(createEvent, { user: host });
    const { code } = response.body as { code: string };

    const [event] = await eventsOf(host);
    expect(event).toMatchObject({
      code,
      niche: "aw",
      language: "sv",
      enabled_modules: ["quiz", "hottakes"],
      party,
      status: "lobby",
      current_module: null,
      phase: "idle",
    });

    const { data: members } = await host.client.from("members").select();
    expect(members).toEqual([
      expect.objectContaining({
        event_id: event?.id,
        user_id: host.id,
        role: "host",
      }),
    ]);
  });

  it("allows an event with no activities and no party content", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, enabledModules: [], party: {} },
      { user: host },
    );

    expect(response.status).toBe(200);
    const [event] = await eventsOf(host);
    expect(event).toMatchObject({ enabled_modules: [], party: {} });
  });

  it("gives every event its own code and key", async () => {
    const host = await anonymousUser();
    const first = await callHostActions(createEvent, { user: host });
    const second = await callHostActions(createEvent, { user: host });

    const a = first.body as { code: string; key: string };
    const b = second.body as { code: string; key: string };
    expect(a.code).not.toBe(b.code);
    expect(a.key).not.toBe(b.key);
  });

  it("stores only the SHA-256 hash of the admin key", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(createEvent, { user: host });
    const { key } = response.body as { key: string };
    const [event] = await eventsOf(host);

    expect(
      sql(
        `select admin_key_hash = encode(sha256(convert_to('${key}', 'UTF8')), 'hex') ` +
          `from private.event_secrets where event_id = '${event?.id}'`,
      ),
    ).toEqual(["t"]);
    expect(JSON.stringify(event)).not.toContain(key);
  });
});

describe("quiz questions", () => {
  /** The questions and keys of the event, read as the service role. */
  async function storedQuiz(code: string) {
    const service = serviceClient();
    const { data: event } = await service
      .from("events")
      .select("id")
      .eq("code", code)
      .single();
    const { data: questions } = await service
      .from("quiz_questions")
      .select("id, position, text, options, status, revealed_at, answer_count")
      .eq("event_id", event?.id ?? "")
      .order("position");
    const { data: keys } = await service
      .from("quiz_answer_keys")
      .select("question_id, correct")
      .in(
        "question_id",
        (questions ?? []).map((row) => row.id),
      );
    return { questions: questions ?? [], keys: keys ?? [] };
  }

  it("stores the questions in order, approved, with their keys", async () => {
    const host = await anonymousUser();
    const quiz = [question(1, 2), question(2, 0), question(3, 3)];
    const response = await callHostActions(
      { ...createEvent, quiz },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };

    const { questions, keys } = await storedQuiz(code);
    expect(questions.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(questions.map((row) => row.text)).toEqual(quiz.map((q) => q.text));
    expect(questions.map((row) => row.options)).toEqual(
      quiz.map((q) => q.options),
    );
    for (const row of questions) {
      expect(row).toMatchObject({
        status: "approved",
        revealed_at: null,
        answer_count: 0,
      });
    }
    const correctByPosition = questions.map(
      (row) => keys.find((key) => key.question_id === row.id)?.correct,
    );
    expect(correctByPosition).toEqual([2, 0, 3]);
  });

  it("lets the host read what was stored, through the app's own client", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, quiz: [question(1), question(2)] },
      { user: host },
    );
    expect(response.status).toBe(200);

    const { data } = await host.client
      .from("quiz_questions")
      .select("position, text")
      .order("position");
    expect(data).toEqual([
      { position: 0, text: "Fråga 1?" },
      { position: 1, text: "Fråga 2?" },
    ]);
  });

  it("accepts exactly 30 questions", async () => {
    const host = await anonymousUser();
    const quiz = Array.from({ length: 30 }, (_, i) => question(i));
    const response = await callHostActions(
      { ...createEvent, quiz },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };
    expect((await storedQuiz(code)).questions).toHaveLength(30);
  });

  it("stores no questions when none are sent, or an empty list", async () => {
    const host = await anonymousUser();
    for (const body of [createEvent, { ...createEvent, quiz: [] }]) {
      const response = await callHostActions(body, { user: host });
      expect(response.status).toBe(200);
      const { code } = response.body as { code: string };
      expect((await storedQuiz(code)).questions).toEqual([]);
    }
  });

  it("allows an empty list with the quiz switched off", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, enabledModules: [], quiz: [] },
      { user: host },
    );
    expect(response.status).toBe(200);
  });
});

describe("award categories", () => {
  const withAwards = { ...createEvent, enabledModules: ["awards"] };
  const category = (n: number) => ({ text: `Mest sannolik att ${n}` });

  /** The categories of the event, read as the service role. */
  async function storedAwards(code: string) {
    const service = serviceClient();
    const { data: event } = await service
      .from("events")
      .select("id")
      .eq("code", code)
      .single();
    const { data } = await service
      .from("award_categories")
      .select("position, text, status, revealed_at, vote_count")
      .eq("event_id", event?.id ?? "")
      .order("position");
    return data ?? [];
  }

  it("stores the categories in order, approved, from position 0", async () => {
    const host = await anonymousUser();
    const awards = [category(1), category(2), category(3)];
    const response = await callHostActions(
      { ...withAwards, awards },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };

    expect(await storedAwards(code)).toEqual(
      awards.map((a, position) => ({
        position,
        text: a.text,
        status: "approved",
        revealed_at: null,
        vote_count: 0,
      })),
    );
  });

  it("stores the texts trimmed", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...withAwards, awards: [{ text: "  Bäst på fika  " }] },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };
    expect((await storedAwards(code)).map((row) => row.text)).toEqual([
      "Bäst på fika",
    ]);
  });

  it("lets the host read what was stored, through the app's own client", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...withAwards, awards: [category(1), category(2)] },
      { user: host },
    );
    expect(response.status).toBe(200);

    const { data } = await host.client
      .from("award_categories")
      .select("position, text")
      .order("position");
    expect(data).toEqual([
      { position: 0, text: "Mest sannolik att 1" },
      { position: 1, text: "Mest sannolik att 2" },
    ]);
  });

  it("accepts exactly 20 categories, next to quiz questions", async () => {
    const host = await anonymousUser();
    const awards = Array.from({ length: 20 }, (_, i) => category(i));
    const response = await callHostActions(
      {
        ...createEvent,
        enabledModules: ["quiz", "awards"],
        quiz: [question(1)],
        awards,
      },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };
    expect(await storedAwards(code)).toHaveLength(20);
  });

  it("stores no categories when none are sent, or an empty list", async () => {
    const host = await anonymousUser();
    for (const body of [withAwards, { ...withAwards, awards: [] }]) {
      const response = await callHostActions(body, { user: host });
      expect(response.status).toBe(200);
      const { code } = response.body as { code: string };
      expect(await storedAwards(code)).toEqual([]);
    }
  });

  it("allows an empty list with awards switched off", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, enabledModules: [], awards: [] },
      { user: host },
    );
    expect(response.status).toBe(200);
  });

  const invalid: [string, unknown][] = [
    [
      "more than 20 categories",
      {
        ...withAwards,
        awards: Array.from({ length: 21 }, (_, i) => category(i)),
      },
    ],
    [
      "a category with an empty text",
      { ...withAwards, awards: [{ text: "" }] },
    ],
    [
      "a category with a blank text",
      { ...withAwards, awards: [{ text: "  " }] },
    ],
    [
      "a category with a too long text",
      { ...withAwards, awards: [{ text: "x".repeat(121) }] },
    ],
    [
      "a category with an unknown field",
      { ...withAwards, awards: [{ ...category(1), status: "draft" }] },
    ],
    ["a category that is only a string", { ...withAwards, awards: ["Hi"] }],
    [
      "categories with awards switched off",
      { ...createEvent, enabledModules: ["quiz"], awards: [category(1)] },
    ],
  ];

  it.each(invalid)("refuses %s with invalid_request", async (_, body) => {
    const host = await anonymousUser();
    const response = await callHostActions(body, { user: host });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await eventsOf(host)).toEqual([]);
  });
});

describe("hot takes", () => {
  const withHotTakes = { ...createEvent, enabledModules: ["hottakes"] };
  const take = (n: number) => ({ text: `Het åsikt ${n}` });

  /** The hot takes of the event, read as the service role. */
  async function storedHotTakes(code: string) {
    const service = serviceClient();
    const { data: event } = await service
      .from("events")
      .select("id")
      .eq("code", code)
      .single();
    const { data } = await service
      .from("hot_takes")
      .select("position, text, status, revealed_at, answer_count")
      .eq("event_id", event?.id ?? "")
      .order("position");
    return data ?? [];
  }

  it("stores the hot takes in order, approved, from position 0", async () => {
    const host = await anonymousUser();
    const hottakes = [take(1), take(2), take(3)];
    const response = await callHostActions(
      { ...withHotTakes, hottakes },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };

    expect(await storedHotTakes(code)).toEqual(
      hottakes.map((a, position) => ({
        position,
        text: a.text,
        status: "approved",
        revealed_at: null,
        answer_count: 0,
      })),
    );
  });

  it("stores the texts trimmed", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...withHotTakes, hottakes: [{ text: "  Bäst på fika  " }] },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };
    expect((await storedHotTakes(code)).map((row) => row.text)).toEqual([
      "Bäst på fika",
    ]);
  });

  it("lets the host read what was stored, through the app's own client", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...withHotTakes, hottakes: [take(1), take(2)] },
      { user: host },
    );
    expect(response.status).toBe(200);

    const { data } = await host.client
      .from("hot_takes")
      .select("position, text")
      .order("position");
    expect(data).toEqual([
      { position: 0, text: "Het åsikt 1" },
      { position: 1, text: "Het åsikt 2" },
    ]);
  });

  it("accepts exactly 20 hot takes, next to quiz questions", async () => {
    const host = await anonymousUser();
    const hottakes = Array.from({ length: 20 }, (_, i) => take(i));
    const response = await callHostActions(
      {
        ...createEvent,
        enabledModules: ["quiz", "hottakes"],
        quiz: [question(1)],
        hottakes,
      },
      { user: host },
    );
    expect(response.status).toBe(200);
    const { code } = response.body as { code: string };
    expect(await storedHotTakes(code)).toHaveLength(20);
  });

  it("stores no hot takes when none are sent, or an empty list", async () => {
    const host = await anonymousUser();
    for (const body of [withHotTakes, { ...withHotTakes, hottakes: [] }]) {
      const response = await callHostActions(body, { user: host });
      expect(response.status).toBe(200);
      const { code } = response.body as { code: string };
      expect(await storedHotTakes(code)).toEqual([]);
    }
  });

  it("allows an empty list with hot takes switched off", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, enabledModules: [], hottakes: [] },
      { user: host },
    );
    expect(response.status).toBe(200);
  });

  const invalid: [string, unknown][] = [
    [
      "more than 20 hot takes",
      {
        ...withHotTakes,
        hottakes: Array.from({ length: 21 }, (_, i) => take(i)),
      },
    ],
    [
      "a hot take with an empty text",
      { ...withHotTakes, hottakes: [{ text: "" }] },
    ],
    [
      "a hot take with a blank text",
      { ...withHotTakes, hottakes: [{ text: "  " }] },
    ],
    [
      "a hot take with a too long text",
      { ...withHotTakes, hottakes: [{ text: "x".repeat(121) }] },
    ],
    [
      "a hot take with an unknown field",
      { ...withHotTakes, hottakes: [{ ...take(1), status: "draft" }] },
    ],
    ["a hot take that is only a string", { ...withHotTakes, hottakes: ["Hi"] }],
    [
      "hot takes with hot takes switched off",
      { ...createEvent, enabledModules: ["quiz"], hottakes: [take(1)] },
    ],
  ];

  it.each(invalid)("refuses %s with invalid_request", async (_, body) => {
    const host = await anonymousUser();
    const response = await callHostActions(body, { user: host });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await eventsOf(host)).toEqual([]);
  });
});

describe("invalid requests", () => {
  const invalid: [string, unknown][] = [
    ["an unknown action", { ...createEvent, action: "drop_tables" }],
    ["no action", { niche: "aw", language: "sv", enabledModules: [], party }],
    ["an unknown niche", { ...createEvent, niche: "wedding" }],
    ["an unknown language", { ...createEvent, language: "de" }],
    ["an unknown activity", { ...createEvent, enabledModules: ["bingo"] }],
    [
      "a duplicate activity",
      { ...createEvent, enabledModules: ["quiz", "quiz"] },
    ],
    ["an unknown field", { ...createEvent, status: "live" }],
    ["unknown party content", { ...createEvent, party: { theme: "dark" } }],
    ["an empty welcome text", { ...createEvent, party: { welcome: "  " } }],
    [
      "a too long welcome text",
      { ...createEvent, party: { welcome: "x".repeat(501) } },
    ],
    [
      "a bad schedule time",
      {
        ...createEvent,
        party: { schedule: [{ time: "25:00", title: "Sent" }] },
      },
    ],
    [
      "a music link that isn't https",
      { ...createEvent, party: { musicUrl: "javascript:alert(1)" } },
    ],
    ["a JSON array", [createEvent]],
    [
      "more than 30 quiz questions",
      {
        ...createEvent,
        quiz: Array.from({ length: 31 }, (_, i) => question(i)),
      },
    ],
    [
      "a quiz question with three options",
      {
        ...createEvent,
        quiz: [{ ...question(1), options: ["a", "b", "c"] }],
      },
    ],
    [
      "a quiz question with an empty text",
      { ...createEvent, quiz: [{ ...question(1), text: " " }] },
    ],
    [
      "a quiz question with a right option of 4",
      { ...createEvent, quiz: [question(1, 4)] },
    ],
    [
      "a quiz question with an unknown field",
      { ...createEvent, quiz: [{ ...question(1), status: "draft" }] },
    ],
    [
      "quiz questions with the quiz switched off",
      { ...createEvent, enabledModules: ["hottakes"], quiz: [question(1)] },
    ],
  ];

  it.each(invalid)("refuses %s with invalid_request", async (_, body) => {
    const host = await anonymousUser();
    const response = await callHostActions(body, { user: host });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await eventsOf(host)).toEqual([]);
  });

  it("refuses a body that isn't JSON with invalid_request", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(null, {
      user: host,
      rawBody: "{not json",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});

describe("authentication", () => {
  it("refuses a request without a session", async () => {
    const response = await callHostActions(createEvent);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "not_authenticated" });
  });

  it("refuses the publishable key in place of a session", async () => {
    // What supabase-js sends for a browser that never signed in.
    const response = await callHostActions(createEvent, {
      bearer: localStack().ANON_KEY,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "not_authenticated" });
  });

  it("refuses a forged token", async () => {
    const response = await callHostActions(createEvent, {
      bearer: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "not_authenticated" });
  });

  it("refuses a session that has signed out", async () => {
    const host = await anonymousUser();
    const { data } = await host.client.auth.getSession();
    await host.client.auth.signOut();

    const response = await callHostActions(createEvent, {
      bearer: data.session?.access_token,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "not_authenticated" });
  });
});

describe("body size cap", () => {
  it("refuses a body over the cap with payload_too_large", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(
      { ...createEvent, party: { welcome: "x".repeat(40 * 1024) } },
      { user: host },
    );

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "payload_too_large" });
    expect(await eventsOf(host)).toEqual([]);
  });

  it("refuses an oversized body before parsing it", async () => {
    // Invalid JSON: it would be invalid_request if it were parsed.
    const host = await anonymousUser();
    const response = await callHostActions(null, {
      user: host,
      rawBody: "{".repeat(40 * 1024),
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: "payload_too_large" });
  });
});

describe("CORS", () => {
  it("answers a preflight from an allowed origin", () => {
    const response = preflight("http://localhost:5173");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(response.headers["access-control-allow-headers"]).toContain(
      "authorization",
    );
  });

  it("refuses a preflight from another origin", () => {
    const response = preflight("https://evil.example");

    expect(response.status).toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("refuses a request from another origin and creates nothing", async () => {
    const host = await anonymousUser();
    const response = await callHostActions(createEvent, {
      user: host,
      origin: "https://evil.example",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: "origin_not_allowed" });
    expect(await eventsOf(host)).toEqual([]);
  });
});

describe("rate limit", () => {
  it("allows five events per user an hour, then answers rate_limited", async () => {
    const host = await anonymousUser();
    for (let i = 0; i < 5; i++) {
      const response = await callHostActions(createEvent, { user: host });
      expect(response.status).toBe(200);
    }

    const sixth = await callHostActions(createEvent, { user: host });
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: "rate_limited" });
    expect(await eventsOf(host)).toHaveLength(5);

    const other = await anonymousUser();
    const response = await callHostActions(createEvent, { user: other });
    expect(response.status).toBe(200);
  });

  it("allows events again once the hour has passed", async () => {
    const host = await anonymousUser();
    for (let i = 0; i < 6; i++) {
      await callHostActions(createEvent, { user: host });
    }
    sql(
      `update private.rate_limits set window_start = window_start - interval '61 minutes' ` +
        `where user_id = '${host.id}' and action = 'create_event'`,
    );

    const response = await callHostActions(createEvent, { user: host });
    expect(response.status).toBe(200);
  });
});

describe("the database calls behind create_event", () => {
  const rpcs = [
    [
      "create_event",
      {
        caller: "00000000-0000-0000-0000-000000000000",
        code: "ABCDEF",
        niche: "aw",
        language: "sv",
        enabled_modules: [],
        party: {},
        admin_key_hash: "0".repeat(64),
      },
    ],
    [
      "consume_rate_limit",
      {
        caller: "00000000-0000-0000-0000-000000000000",
        action: "create_event",
        max_attempts: 1000,
        window_seconds: 1,
      },
    ],
  ] as const;

  it.each(rpcs)("no client role can call %s", async (name, args) => {
    const guest = await anonymousUser();
    for (const client of [guest.client, signedOutClient()]) {
      const { error } = await client.rpc(name, args as never);
      expect(error?.code).toBe("42501");
    }
  });

  it("no client role can read private.event_secrets", async () => {
    for (const role of ["anon", "authenticated"]) {
      expect(() =>
        sql(`set role ${role}; select count(*) from private.event_secrets`),
      ).toThrow(/permission denied for schema private/);
    }
    const guest = await anonymousUser();
    const { data, error } = await guest.client
      .schema("private" as "public")
      .from("event_secrets" as "events")
      .select();
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("create_event answers null for a taken code, so host-actions can retry", async () => {
    const [first, second] = [await anonymousUser(), await anonymousUser()];
    const code = randomCode();
    const call = (caller: string) =>
      serviceClient().rpc("create_event", {
        caller,
        code,
        niche: "aw",
        language: "en",
        enabled_modules: [],
        party: {},
        admin_key_hash: "0".repeat(64),
      });

    const created = await call(first.id);
    expect(created.error).toBeNull();
    expect(created.data).toEqual(expect.any(String));

    const clash = await call(second.id);
    expect(clash.error).toBeNull();
    expect(clash.data).toBeNull();
    expect(await eventsOf(second)).toEqual([]);
  });
});
