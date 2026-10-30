// Host control panel spec (#75), ticket #81: host-actions `set_modules`, the
// host switching activities on and off. Called over HTTP through `supabase
// functions serve`; the list is read back as a member of the event.
import { describe, expect, it } from "vitest";
import { anonymousUser, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import {
  moves,
  otherKey,
  setFlow,
  unusedCode,
  type HostLink,
} from "./host-helpers";

type Host = HostLink & { user: User };

const threeQuestions = [1, 2, 3].map((n) => ({
  text: `Question ${n}?`,
  options: ["Ett", "Två", "Tre", "Fyra"],
  correct: 0,
}));

async function createEvent(
  enabledModules: string[] = ["quiz", "awards"],
): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules,
      party: {},
      ...(enabledModules.includes("quiz") ? { quiz: threeQuestions } : {}),
    },
    { user },
  );
  expect(response.status).toBe(200);
  return { ...(response.body as HostLink), user };
}

function setModules(host: Host, modules: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "set_modules", code: link.code, key: link.key, modules },
    { user: host.user },
  );
}

async function enabledOf(host: Host): Promise<string[]> {
  const { data, error } = await host.user.client
    .from("events")
    .select("enabled_modules")
    .eq("code", host.code)
    .single();
  if (error) throw error;
  return data.enabled_modules;
}

describe("set_modules with the right key", () => {
  it("saves the activities in the order sent, answering {}", async () => {
    const host = await createEvent(["quiz"]);

    const response = await setModules(host, ["hottakes", "quiz", "awards"]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await enabledOf(host)).toEqual(["hottakes", "quiz", "awards"]);
  });

  it("switches every activity off with an empty list", async () => {
    const host = await createEvent();

    expect((await setModules(host, [])).status).toBe(200);
    expect(await enabledOf(host)).toEqual([]);
  });

  it("lets a switched-on activity start", async () => {
    const host = await createEvent(["awards"]);
    await setModules(host, ["awards", "quiz"]);
    // The quiz has no questions yet, so it can't start, but it is allowed.
    const response = await setFlow(host, {
      type: "start_module",
      module: "quiz",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_empty" });
  });

  it("rejects an unknown id", async () => {
    const host = await createEvent();

    const response = await setModules(host, ["quiz", "karaoke"]);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });

  it("rejects a repeated id and a list that isn't an array", async () => {
    const host = await createEvent();

    for (const modules of [["quiz", "quiz"], "quiz", null, [1]]) {
      const response = await setModules(host, modules);
      expect(response.status, JSON.stringify(modules)).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });
});

describe("set_modules while an activity runs", () => {
  it("refuses a list without the running activity", async () => {
    const host = await createEvent();
    await moves(host, { type: "start_module", module: "quiz" });

    const response = await setModules(host, ["awards"]);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });

  it("allows other changes, and the running activity moving in the list", async () => {
    const host = await createEvent();
    await moves(host, { type: "start_module", module: "quiz" });

    expect((await setModules(host, ["quiz"])).status).toBe(200);
    expect((await setModules(host, ["hottakes", "quiz"])).status).toBe(200);
    expect(await enabledOf(host)).toEqual(["hottakes", "quiz"]);
  });

  it("allows switching off an activity that was played", async () => {
    const host = await createEvent();
    await moves(
      host,
      { type: "start_module", module: "quiz" },
      { type: "stop_module" },
    );

    expect((await setModules(host, ["awards"])).status).toBe(200);
    expect(await enabledOf(host)).toEqual(["awards"]);
  });
});

describe("set_modules after the evening ended", () => {
  it("answers invalid_transition and changes nothing", async () => {
    const host = await createEvent();
    await moves(host, { type: "end_event" });

    const response = await setModules(host, ["quiz"]);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });
});

describe("set_modules without the right key", () => {
  it("answers a wrong key, an unknown code and another event's key alike", async () => {
    const host = await createEvent();
    const other = await createEvent();

    const answers = [
      await setModules(host, [], { code: host.code, key: otherKey(host.key) }),
      await setModules(host, [], { code: unusedCode(), key: host.key }),
      await setModules(host, [], { code: host.code, key: other.key }),
    ];

    for (const answer of answers) {
      expect(answer.status).toBe(answers[0]?.status);
      expect(answer.body).toEqual(answers[0]?.body);
    }
    expect(answers[0]?.body).toEqual({ error: "not_authorized" });
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });
});

describe("set_enabled_modules as a client", () => {
  it("can't be called by the host's own login", async () => {
    const host = await createEvent();
    const [eventId = ""] = sql(
      `select id from public.events where code = '${host.code}'`,
    );

    const { error } = await host.user.client.rpc("set_enabled_modules", {
      target_event_id: eventId,
      modules: [],
    });

    expect(error).not.toBeNull();
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });
});

describe("rate limit on set_modules", () => {
  const limit = 10;

  it(`allows ${limit} saves per user and event, then refuses`, async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) {
      expect((await setModules(host, ["quiz", "awards"])).status).toBe(200);
    }

    const response = await setModules(host, ["quiz"]);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await enabledOf(host)).toEqual(["quiz", "awards"]);
  });

  it("allows saves again once the window has passed", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await setModules(host, ["quiz"]);
    sql(
      `update private.rate_limits set window_start = window_start - interval '61 seconds' ` +
        `where user_id = '${host.user.id}' and action like 'set_modules:%'`,
    );

    expect((await setModules(host, ["awards"])).status).toBe(200);
  });
});
