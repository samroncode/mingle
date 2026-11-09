// Competitions spec (#262), ticket #267: the host puts one competition's
// table on the TV through `set_flow`. The step of the running activity is the
// competition's position. Called over HTTP through `supabase functions serve`;
// the flow is read back as members of the event.
import { describe, expect, it } from "vitest";
import { anonymousUser, signedOutClient, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import {
  moves,
  otherKey,
  setFlow,
  type HostLink,
  type Move,
} from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };

/** Creates an event through host-actions with the competitions given. */
async function createHost(
  names: string[] = ["Ping pong", "Darts"],
  enabledModules: string[] = ["competitions", "quiz"],
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

const show = (competition?: number): Move => ({
  type: "start_module",
  module: "competitions",
  ...(competition === undefined ? {} : { competition }),
});
const stop: Move = { type: "stop_module" };

type Flow = {
  status: string;
  current_module: string | null;
  current_step: number;
  phase: string;
};

async function flowOf(host: Host, client = host.user.client): Promise<Flow> {
  const { data, error } = await client
    .from("events")
    .select("status, current_module, current_step, phase")
    .eq("id", host.eventId)
    .single();
  if (error) throw error;
  return data;
}

const idle: Flow = {
  status: "lobby",
  current_module: null,
  current_step: 0,
  phase: "idle",
};
const spotlight = (step: number): Flow => ({
  status: "live",
  current_module: "competitions",
  current_step: step,
  phase: "idle",
});

describe("start_module for competitions", () => {
  it("shows the first competition by default", async () => {
    const host = await createHost();
    const response = await setFlow(host, show());
    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(spotlight(0));
  });

  it("shows the competition at the position the host names", async () => {
    const host = await createHost();
    await moves(host, show(1));
    expect(await flowOf(host)).toEqual(spotlight(1));
  });

  it("refuses a position with no competition", async () => {
    const host = await createHost();
    const response = await setFlow(host, show(2));
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await flowOf(host)).toEqual(idle);
  });

  it("refuses with module_empty when there are no competitions", async () => {
    const host = await createHost([]);
    const response = await setFlow(host, show());
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_empty" });
  });

  it("refuses with module_disabled when Competitions is off", async () => {
    const host = await createHost(["Ping pong"], ["quiz"]);
    const response = await setFlow(host, show());
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_disabled" });
  });

  it("refuses while another activity runs, and the other way round", async () => {
    const host = await createHost();
    await moves(host, show(0));
    const quiz = await setFlow(host, { type: "start_module", module: "quiz" });
    expect(quiz.body).toEqual({ error: "invalid_transition" });
    expect(await flowOf(host)).toEqual(spotlight(0));

    await moves(host, stop);
    sql(
      `update public.events set status = 'live', current_module = 'quiz' where id = '${host.eventId}'`,
    );
    const again = await setFlow(host, show(0));
    expect(again.body).toEqual({ error: "invalid_transition" });
  });

  it("has no open, reveal or next_step", async () => {
    const host = await createHost();
    await moves(host, show(0));
    for (const type of ["open", "reveal", "next_step"]) {
      const response = await setFlow(host, { type });
      expect(response.body, type).toEqual({ error: "invalid_transition" });
    }
    expect(await flowOf(host)).toEqual(spotlight(0));
  });

  it("refuses a competition for another activity", async () => {
    const host = await createHost();
    const response = await setFlow(host, {
      type: "start_module",
      module: "quiz",
      competition: 0,
    });
    expect(response.body).toEqual({ error: "invalid_transition" });
  });
});

describe("stopping the spotlight", () => {
  it("returns the TV to the party screen, and it can start again", async () => {
    const host = await createHost();
    await moves(host, show(1), stop);
    expect(await flowOf(host)).toEqual({ ...idle, status: "live" });
    await moves(host, show(0));
    expect(await flowOf(host)).toEqual(spotlight(0));
  });

  it("is refused when nothing is running", async () => {
    const host = await createHost();
    const response = await setFlow(host, stop);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });
});

describe("who can move the spotlight", () => {
  it("refuses a wrong key and an unknown event", async () => {
    const host = await createHost();
    const wrong = await setFlow(host, show(0), {
      code: host.code,
      key: otherKey(host.key),
    });
    expect(wrong.status).toBe(403);
    expect(await flowOf(host)).toEqual(idle);
  });

  it("refuses a guest who calls host-actions with the wrong key", async () => {
    const host = await createHost();
    const guest = await anonymousUser();
    const response = await callHostActions(
      {
        action: "set_flow",
        code: host.code,
        key: otherKey(host.key),
        move: show(0),
      },
      { user: guest },
    );
    expect(response.status).toBe(403);
    expect(await flowOf(host)).toEqual(idle);
  });

  it("lets a guest not write the flow straight to the table", async () => {
    const host = await createHost();
    const guest = await anonymousUser();
    sql(
      `insert into public.members (event_id, user_id, role, display_name) ` +
        `values ('${host.eventId}', '${guest.id}', 'guest', 'Anna')`,
    );
    const { error } = await guest.client
      .from("events")
      .update({ status: "live", current_module: "competitions" })
      .eq("id", host.eventId);
    expect(error).not.toBeNull();
    expect(await flowOf(host)).toEqual(idle);
  });

  it("lets members read the spotlight, and non-members and signed-out clients not", async () => {
    const host = await createHost();
    await moves(host, show(1));
    const guest = await anonymousUser();
    sql(
      `insert into public.members (event_id, user_id, role, display_name) ` +
        `values ('${host.eventId}', '${guest.id}', 'guest', 'Anna')`,
    );
    expect(await flowOf(host, guest.client)).toEqual(spotlight(1));

    const outsider = await anonymousUser();
    const read = await outsider.client
      .from("events")
      .select("current_module, current_step")
      .eq("id", host.eventId);
    expect(read.data).toEqual([]);

    const signedOut = await signedOutClient()
      .from("events")
      .select("current_module")
      .eq("id", host.eventId);
    expect(signedOut.data ?? []).toEqual([]);
  });
});
