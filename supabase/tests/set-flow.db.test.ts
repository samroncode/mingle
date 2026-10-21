// #20: host-actions `set_flow`, the host moving the event's flow. Called over
// HTTP through `supabase functions serve`; the results are read back as a
// member of the event.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  randomCode,
  signedOutClient,
  sql,
  type User,
} from "./helpers";
import { callHostActions } from "./functions";

type HostLink = { code: string; key: string };
type Host = HostLink & { user: User };
type Move = { type: string; module?: string };

/** Creates an event through host-actions, as the wizard does. */
async function createEvent(
  enabledModules: string[] = ["quiz", "awards", "hottakes"],
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
  return { ...(response.body as HostLink), user };
}

function setFlow(host: Host, move: Move, link: HostLink = host) {
  return callHostActions(
    { action: "set_flow", code: link.code, key: link.key, move },
    { user: host.user },
  );
}

/** The event's flow columns, as its host reads them. */
async function flowOf(host: Host) {
  const { data, error } = await host.user.client
    .from("events")
    .select("status, current_module, current_step, phase")
    .eq("code", host.code)
    .single();
  if (error) throw error;
  return data;
}

describe("set_flow: the valid moves", () => {
  it("start_module sets the event live on step 0 of the module, idle", async () => {
    const host = await createEvent();

    const response = await setFlow(host, {
      type: "start_module",
      module: "quiz",
    });

    expect(response.status).toBe(200);
    const flow = {
      status: "live",
      currentModule: "quiz",
      currentStep: 0,
      phase: "idle",
    };
    expect(response.body).toEqual(flow);
    expect(await flowOf(host)).toEqual({
      status: "live",
      current_module: "quiz",
      current_step: 0,
      phase: "idle",
    });
  });

  it("open lets guests answer the current step", async () => {
    const host = await createEvent();
    await moves(host, start("quiz"));

    const response = await setFlow(host, { type: "open" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(live("quiz", 0, "open"));
  });

  it("reveal shows the results of an open step", async () => {
    const host = await createEvent();
    await moves(host, start("quiz"), { type: "open" });

    const response = await setFlow(host, { type: "reveal" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(live("quiz", 0, "revealed"));
  });

  it("next_step after a reveal moves to the next step, idle", async () => {
    const host = await createEvent();
    await moves(host, start("quiz"), { type: "open" }, { type: "reveal" });

    const response = await setFlow(host, { type: "next_step" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "live",
      currentModule: "quiz",
      currentStep: 1,
      phase: "idle",
    });
    expect(await flowOf(host)).toEqual(live("quiz", 1, "idle"));
  });

  it("next_step skips a step that was never opened", async () => {
    const host = await createEvent();
    await moves(host, start("hottakes"), { type: "next_step" });

    const response = await setFlow(host, { type: "next_step" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(live("hottakes", 2, "idle"));
  });

  it("stop_module returns the live event to the party screen", async () => {
    const host = await createEvent();
    await moves(host, start("awards"), { type: "open" });

    const response = await setFlow(host, { type: "stop_module" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(partyScreen);
  });

  it("start_module from the party screen starts another activity", async () => {
    const host = await createEvent();
    await moves(
      host,
      start("quiz"),
      { type: "next_step" },
      { type: "stop_module" },
    );

    const response = await setFlow(host, start("awards"));

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(live("awards", 0, "idle"));
  });

  it("end_event ends an event that never started", async () => {
    const host = await createEvent();

    const response = await setFlow(host, { type: "end_event" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(ended);
  });

  it("end_event ends the event in the middle of an open step", async () => {
    const host = await createEvent();
    await moves(host, start("quiz"), { type: "next_step" }, { type: "open" });

    const response = await setFlow(host, { type: "end_event" });

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(ended);
  });

  it("works for a co-host who claimed the host link", async () => {
    const host = await createEvent();
    const coHost = { ...host, user: await anonymousUser() };
    await callHostActions(
      { action: "claim_host", code: host.code, key: host.key },
      { user: coHost.user },
    );

    expect((await setFlow(coHost, start("quiz"))).status).toBe(200);
    expect(await flowOf(host)).toEqual(live("quiz", 0, "idle"));
  });

  it("never returns the key", async () => {
    const host = await createEvent();
    const response = await setFlow(host, start("quiz"));

    expect(response.text).not.toContain(host.key);
  });
});

describe("set_flow: moves the state doesn't allow", () => {
  it.each<[string, Move[], Move]>([
    ["open with nothing running", [], { type: "open" }],
    ["reveal with nothing running", [], { type: "reveal" }],
    ["next_step with nothing running", [], { type: "next_step" }],
    ["stop_module with nothing running", [], { type: "stop_module" }],
    ["reveal before open", [start("quiz")], { type: "reveal" }],
    ["open twice", [start("quiz"), { type: "open" }], { type: "open" }],
    [
      "next_step while the step is open",
      [start("quiz"), { type: "open" }],
      { type: "next_step" },
    ],
    [
      "reveal twice",
      [start("quiz"), { type: "open" }, { type: "reveal" }],
      { type: "reveal" },
    ],
    [
      "open after a reveal",
      [start("quiz"), { type: "open" }, { type: "reveal" }],
      { type: "open" },
    ],
    ["start_module while another is running", [start("quiz")], start("awards")],
    ["start_module of the running one again", [start("quiz")], start("quiz")],
    [
      "next_step on the party screen",
      [start("quiz"), { type: "stop_module" }],
      { type: "next_step" },
    ],
  ])("refuses %s and changes nothing", async (_, before, move) => {
    const host = await createEvent();
    await moves(host, ...before);
    const flow = await flowOf(host);

    const response = await setFlow(host, move);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await flowOf(host)).toEqual(flow);
  });

  it("lets only one of two simultaneous moves from the same state land", async () => {
    const host = await createEvent();
    await moves(host, start("quiz"));

    const responses = await Promise.all([
      setFlow(host, { type: "open" }),
      setFlow(host, { type: "open" }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await flowOf(host)).toEqual(live("quiz", 0, "open"));
  });

  it.each([
    ["an unknown activity", { type: "start_module", module: "bingo" }],
    ["start_module without an activity", { type: "start_module" }],
    ["an unknown move", { type: "rewind" }],
    ["a move with extra fields", { type: "next_step", step: 7 }],
  ])("refuses %s with invalid_request", async (_, move) => {
    const host = await createEvent();

    const response = await setFlow(host, move);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await flowOf(host)).toEqual(lobby);
  });

  it("refuses a flow field set directly in the request", async () => {
    const host = await createEvent();
    const response = await callHostActions(
      {
        action: "set_flow",
        code: host.code,
        key: host.key,
        move: { type: "end_event" },
        status: "live",
      },
      { user: host.user },
    );

    expect(response.status).toBe(400);
    expect(await flowOf(host)).toEqual(lobby);
  });
});

describe("set_flow: activities the host turned off", () => {
  it("refuses to start a disabled activity with module_disabled", async () => {
    const host = await createEvent(["quiz"]);

    const response = await setFlow(host, start("awards"));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_disabled" });
    expect(await flowOf(host)).toEqual(lobby);
  });

  it("refuses every activity when none is enabled", async () => {
    const host = await createEvent([]);

    for (const module of ["quiz", "awards", "hottakes"]) {
      const response = await setFlow(host, start(module));
      expect(response.body).toEqual({ error: "module_disabled" });
    }
    expect(await flowOf(host)).toEqual(lobby);
  });

  it("still starts the enabled one", async () => {
    const host = await createEvent(["hottakes"]);

    expect((await setFlow(host, start("hottakes"))).status).toBe(200);
  });
});

describe("set_flow: after the event ended", () => {
  it.each<Move>([
    start("quiz"),
    { type: "stop_module" },
    { type: "next_step" },
    { type: "open" },
    { type: "reveal" },
    { type: "end_event" },
  ])("refuses $type and changes nothing", async (move) => {
    const host = await createEvent();
    await moves(host, start("quiz"), { type: "end_event" });

    const response = await setFlow(host, move);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await flowOf(host)).toEqual(ended);
  });

  it("refuses new guests and TVs with ended", async () => {
    const host = await createEvent();
    await moves(host, { type: "end_event" });
    const [guest, tv] = [await anonymousUser(), await anonymousUser()];

    const asGuest = await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });
    const asTv = await tv.client.rpc("join_tv", { code: host.code });

    expect(asGuest.data).toEqual({ event_id: null, error: "ended" });
    expect(asTv.data).toEqual({ event_id: null, error: "ended" });
  });
});

describe("set_flow without the right key", () => {
  async function expectRefused(host: Host, link: HostLink) {
    const response = await setFlow(host, start("quiz"), link);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await flowOf(host)).toEqual(lobby);
  }

  it("refuses a wrong key", async () => {
    const host = await createEvent();
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createEvent(), createEvent()]);
    await expectRefused(host, { code: host.code, key: other.key });
    expect(await flowOf(other)).toEqual(lobby);
  });

  it("refuses an unknown code", async () => {
    const host = await createEvent();
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("refuses a guest of the event who has no key", async () => {
    const host = await createEvent();
    const guest = await anonymousUser();
    await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });

    const response = await setFlow({ ...host, user: guest }, start("quiz"), {
      code: host.code,
      key: otherKey(host.key),
    });

    expect(response.status).toBe(403);
    expect(await flowOf(host)).toEqual(lobby);
  });
});

describe("rate limit on set_flow", () => {
  const limit = 30;

  it(`allows ${limit} moves per user and event, then refuses even valid ones`, async () => {
    const host = await createEvent();
    // Refused moves count too, and leave the event in the lobby.
    for (let i = 0; i < limit; i++) {
      expect((await setFlow(host, { type: "stop_module" })).status).toBe(409);
    }

    const response = await setFlow(host, start("quiz"));

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await flowOf(host)).toEqual(lobby);
  });

  it("counts each event on its own", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await setFlow(host, { type: "next_step" });
    const second = await createEvent();

    const response = await setFlow(
      { ...second, user: host.user },
      start("quiz"),
    );

    expect(response.status).toBe(200);
  });

  it("counts each user on its own", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await setFlow(host, { type: "next_step" });
    const coHost = { ...host, user: await anonymousUser() };

    expect((await setFlow(coHost, start("quiz"))).status).toBe(200);
  });

  it("allows moves again once the window has passed", async () => {
    const host = await createEvent();
    for (let i = 0; i < limit; i++) await setFlow(host, { type: "next_step" });
    sql(
      `update private.rate_limits set window_start = window_start - interval '61 seconds' ` +
        `where user_id = '${host.user.id}' and action like 'set_flow:%'`,
    );

    expect((await setFlow(host, start("quiz"))).status).toBe(200);
  });
});

describe("the flow outside host-actions", () => {
  const changes = [
    { status: "ended" },
    { current_module: "quiz", status: "live" },
    { current_step: 4 },
    { phase: "open" },
    { enabled_modules: ["quiz", "awards", "hottakes"] },
  ];

  it.each(["guest", "tv", "host"] as const)(
    "the %s can't change any flow column directly",
    async (role) => {
      const host = await createEvent(["quiz"]);
      const member = role === "host" ? host.user : await anonymousUser();
      if (role === "guest") {
        await member.client.rpc("join_event", {
          code: host.code,
          display_name: "Anna",
        });
      } else if (role === "tv") {
        await member.client.rpc("join_tv", { code: host.code });
      }

      for (const change of changes) {
        const { error } = await member.client
          .from("events")
          .update(change)
          .eq("code", host.code);
        expect(error).not.toBeNull();
      }
      expect(await flowOf(host)).toEqual(lobby);
    },
  );

  it("no client role can call set_event_flow", async () => {
    const host = await createEvent();
    const [eventId = ""] = sql(
      `select id from public.events where code = '${host.code}'`,
    );
    const args = {
      target_event_id: eventId,
      from_status: "lobby",
      from_step: 0,
      from_phase: "idle",
      to_status: "ended",
      to_step: 0,
      to_phase: "idle",
    };
    for (const client of [host.user.client, signedOutClient()]) {
      const { error } = await client.rpc("set_event_flow", args);
      expect(error?.code).toBe("42501");
    }
    expect(await flowOf(host)).toEqual(lobby);
  });

  it.each([
    ["an activity in the lobby", "current_module = 'quiz'"],
    ["an activity after the end", "status = 'ended', current_module = 'quiz'"],
    ["a disabled activity", "status = 'live', current_module = 'awards'"],
    ["a step on the party screen", "status = 'live', current_step = 2"],
    ["an open phase with nothing running", "phase = 'open'"],
  ])("the database refuses %s", async (_, assignments) => {
    const host = await createEvent(["quiz"]);

    expect(() =>
      sql(
        `update public.events set ${assignments} where code = '${host.code}'`,
      ),
    ).toThrow(/events_flow_check/);
    expect(await flowOf(host)).toEqual(lobby);
  });
});

const lobby = {
  status: "lobby",
  current_module: null,
  current_step: 0,
  phase: "idle",
};
const partyScreen = { ...lobby, status: "live" };
const ended = { ...lobby, status: "ended" };

function live(module: string, step: number, phase: string) {
  return {
    status: "live",
    current_module: module,
    current_step: step,
    phase,
  };
}

function start(module: string): Move {
  return { type: "start_module", module };
}

/** Makes the moves in order, each of which must be allowed. */
async function moves(host: Host, ...list: Move[]): Promise<void> {
  for (const move of list) {
    const response = await setFlow(host, move);
    expect(response.status).toBe(200);
  }
}

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
