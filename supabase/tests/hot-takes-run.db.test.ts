// Hot takes spec (#67), ticket #71: the host runs hot takes. `set_flow` over
// HTTP takes its step bounds from the hot takes (start at the first
// unrevealed one, the summary step, `module_empty`, `module_finished`); a
// reveal marks the hot take in the database; members read the progress.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  seedHotTake,
  seedCast,
  serviceClient,
  setEventFlow,
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

/** Creates an event with `count` hot takes through host-actions. */
async function createHotTakes(count: number): Promise<Host> {
  const user = await anonymousUser();
  const takes = Array.from({ length: count }, (_, i) => ({
    text: `Hot take ${i + 1}`,
  }));
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "en",
      enabledModules: ["hottakes", "awards"],
      party: {},
      ...(count > 0 ? { hottakes: takes } : {}),
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

const startHotTakes: Move = { type: "start_module", module: "hottakes" };
const open: Move = { type: "open" };
const reveal: Move = { type: "reveal" };
const next: Move = { type: "next_step" };
const stop: Move = { type: "stop_module" };

/** Plays one hot take: open, reveal, next. */
const play: Move[] = [open, reveal, next];

/** The event's flow columns, as its host reads them. */
async function flowOf(host: Host) {
  const { data, error } = await host.user.client
    .from("events")
    .select("status, current_module, current_step, phase")
    .eq("id", host.eventId)
    .single();
  if (error) throw error;
  return data;
}

function hotTakesAt(step: number, phase = "idle") {
  return {
    status: "live",
    current_module: "hottakes",
    current_step: step,
    phase,
  };
}

/** The positions of the event's hot takes that are revealed. */
function revealedPositions(eventId: string): number[] {
  return sql(
    `select position from public.hot_takes ` +
      `where event_id = '${eventId}' and revealed_at is not null order by position`,
  ).map(Number);
}

describe("start_module for hot takes", () => {
  it("starts at the first hot take", async () => {
    const host = await createHotTakes(3);

    const response = await setFlow(host, startHotTakes);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "live",
      currentModule: "hottakes",
      currentStep: 0,
      phase: "idle",
    });
    expect(await flowOf(host)).toEqual(hotTakesAt(0));
  });

  it("resumes at the first unrevealed hot take after a stop", async () => {
    const host = await createHotTakes(4);
    await moves(host, startHotTakes, ...play, ...play, stop);

    const response = await setFlow(host, startHotTakes);

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(hotTakesAt(2));
  });

  it("resumes at a hot take that was opened but never revealed", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, ...play, open, stop);

    await moves(host, startHotTakes);

    expect(await flowOf(host)).toEqual(hotTakesAt(1));
  });

  it("answers module_empty for no hot takes", async () => {
    const host = await createHotTakes(0);

    const response = await setFlow(host, startHotTakes);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_empty" });
    expect((await flowOf(host)).status).toBe("lobby");
  });

  it("answers module_finished once every hot take was revealed", async () => {
    const host = await createHotTakes(2);
    await moves(host, startHotTakes, ...play, ...play, stop);

    const response = await setFlow(host, startHotTakes);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_finished" });
    expect(await flowOf(host)).toEqual({
      ...hotTakesAt(0),
      current_module: null,
    });
  });

  it("counts only approved hot takes", async () => {
    const host = await createHotTakes(1);
    await seedHotTake(host.eventId, 1, { status: "draft" });
    await moves(host, startHotTakes, ...play, stop);

    const response = await setFlow(host, startHotTakes);

    expect(response.body).toEqual({ error: "module_finished" });
  });
});

describe("the summary step", () => {
  it("next_step after the last hot take moves to step = number of hot takes", async () => {
    const host = await createHotTakes(2);
    await moves(host, startHotTakes, ...play, open, reveal);

    const response = await setFlow(host, next);

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(hotTakesAt(2));
  });

  it.each([open, reveal, next])(
    "refuses $type on the summary step",
    async (move) => {
      const host = await createHotTakes(1);
      await moves(host, startHotTakes, ...play);

      const response = await setFlow(host, move);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "invalid_transition" });
      expect(await flowOf(host)).toEqual(hotTakesAt(1));
    },
  );

  it("stop_module goes back to the party screen", async () => {
    const host = await createHotTakes(1);
    await moves(host, startHotTakes, ...play);

    await moves(host, stop);

    expect(await flowOf(host)).toEqual({
      ...hotTakesAt(0),
      current_module: null,
    });
  });
});

describe("set_flow for hot takes without the right key", () => {
  it.each([
    [
      "a wrong key",
      (host: Host) => ({ code: host.code, key: otherKey(host.key) }),
    ],
    [
      "an unknown code",
      (host: Host) => ({ code: unusedCode(), key: host.key }),
    ],
  ])("refuses %s with not_authorized", async (_, link) => {
    const host = await createHotTakes(2);

    const response = await setFlow(host, startHotTakes, link(host));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect((await flowOf(host)).status).toBe("lobby");
  });

  it("refuses a wrong key for empty hot takes the same way", async () => {
    const host = await createHotTakes(0);

    const response = await setFlow(host, startHotTakes, {
      code: host.code,
      key: otherKey(host.key),
    });

    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("a reveal marks the hot take as revealed", () => {
  it("sets the revealed time of the current hot take, and only that one", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, ...play, open);
    expect(revealedPositions(host.eventId)).toEqual([0]);

    await moves(host, reveal);

    expect(revealedPositions(host.eventId)).toEqual([0, 1]);
  });

  it("leaves skipped and opened hot takes unrevealed", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, next, open);

    expect(revealedPositions(host.eventId)).toEqual([]);
  });

  it("never changes the time of a hot take revealed earlier", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    await seedHotTake(cast.event.id, 0, { revealed: true });
    const before = revealedAt(cast.event.id);

    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "hottakes",
      current_step: 0,
      phase: "open",
    });
    await setEventFlow(cast.event.id, { phase: "revealed" });

    expect(revealedAt(cast.event.id)).toBe(before);
  });

  it("marks nothing when another activity reveals a step", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes", "awards"] });
    await seedHotTake(cast.event.id, 0);

    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "awards",
      current_step: 0,
      phase: "open",
    });
    await setEventFlow(cast.event.id, { phase: "revealed" });

    expect(revealedPositions(cast.event.id)).toEqual([]);
  });

  it("marks nothing when the flow write is refused", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    await seedHotTake(cast.event.id, 0);
    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "hottakes",
      current_step: 0,
      phase: "open",
    });

    // A reveal that also breaks events_flow_check rolls back as a whole.
    expect(() =>
      sql(
        `update public.events set phase = 'revealed', status = 'lobby' ` +
          `where id = '${cast.event.id}'`,
      ),
    ).toThrow(/events_flow_check/);
    expect(revealedPositions(cast.event.id)).toEqual([]);
  });

  function revealedAt(eventId: string): string | undefined {
    return sql(
      `select revealed_at from public.hot_takes where event_id = '${eventId}'`,
    )[0];
  }
});

describe("what guests and the TV read while the host runs hot takes", () => {
  async function joinedHotTakes(count: number) {
    const host = await createHotTakes(count);
    const [guest, tv] = [await anonymousUser(), await anonymousUser()];
    await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });
    await tv.client.rpc("join_tv", { code: host.code });
    return { host, viewers: [guest, tv] };
  }

  async function positionsOf(viewer: User, eventId: string) {
    const { data } = await viewer.client
      .from("hot_takes")
      .select("position")
      .eq("event_id", eventId)
      .order("position");
    return (data ?? []).map((row) => row.position);
  }

  it("nothing before the hot take opens, then the hot take, and it stays readable after", async () => {
    const { host, viewers } = await joinedHotTakes(2);

    await moves(host, startHotTakes);
    for (const viewer of viewers) {
      expect(await positionsOf(viewer, host.eventId)).toEqual([]);
    }

    await moves(host, open);
    for (const viewer of viewers) {
      expect(await positionsOf(viewer, host.eventId)).toEqual([0]);
    }

    await moves(host, reveal, next);
    for (const viewer of viewers) {
      expect(await positionsOf(viewer, host.eventId)).toEqual([0]);
    }
  });
});

describe("hot_take_progress", () => {
  async function progressOf(client: User["client"], eventId: string) {
    const { data, error } = await client.rpc("hot_take_progress", {
      target_event_id: eventId,
    });
    expect(error).toBeNull();
    return data;
  }

  it("gives every member the number of approved hot takes and how many are revealed", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    await seedHotTake(cast.event.id, 0, { revealed: true });
    await seedHotTake(cast.event.id, 1, { revealed: true });
    await seedHotTake(cast.event.id, 2);
    await seedHotTake(cast.event.id, 3, { status: "draft" });

    for (const member of [cast.host, cast.guestA, cast.tv]) {
      expect(await progressOf(member.client, cast.event.id)).toEqual([
        { total: 3, revealed: 2 },
      ]);
    }
  });

  it("counts zero without hot takes", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });

    expect(await progressOf(cast.guestA.client, cast.event.id)).toEqual([
      { total: 0, revealed: 0 },
    ]);
  });

  it("follows the host's reveals", async () => {
    const host = await createHotTakes(3);
    await moves(host, startHotTakes, ...play, open, reveal);

    expect(await progressOf(host.user.client, host.eventId)).toEqual([
      { total: 3, revealed: 2 },
    ]);
  });

  it("gives non-members and the host of another event nothing", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    await seedHotTake(cast.event.id, 0, { revealed: true });

    for (const outsider of [cast.nonMember, cast.otherHost]) {
      expect(await progressOf(outsider.client, cast.event.id)).toEqual([]);
    }
  });

  it("can't be called without a session", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });

    const { data, error } = await signedOutClient().rpc("hot_take_progress", {
      target_event_id: cast.event.id,
    });

    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  it("gives nothing for an expired event", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    await seedHotTake(cast.event.id, 0);
    await serviceClient()
      .from("events")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", cast.event.id);

    expect(await progressOf(cast.guestA.client, cast.event.id)).toEqual([]);
  });
});
