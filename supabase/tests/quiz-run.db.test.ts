// #54: the host runs the quiz. `set_flow` over HTTP takes its step bounds
// from the quiz's questions (start at the first unplayed one, the results
// step, `module_empty`, `module_finished`); a reveal marks the question as
// played in the database; members read the quiz's progress.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  randomCode,
  seedCast,
  seedQuizQuestion,
  serviceClient,
  setEventFlow,
  signedOutClient,
  sql,
  type User,
} from "./helpers";
import { callHostActions } from "./functions";

type HostLink = { code: string; key: string };
type Host = HostLink & { user: User; eventId: string };
type Move = { type: string; module?: string };

const options = ["Ett", "Två", "Tre", "Fyra"];

/** Creates an event with `count` quiz questions through host-actions. */
async function createQuiz(count: number): Promise<Host> {
  const user = await anonymousUser();
  const quiz = Array.from({ length: count }, (_, i) => ({
    text: `Question ${i + 1}?`,
    options,
    correct: i % 4,
  }));
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "awards"],
      party: {},
      ...(count > 0 ? { quiz } : {}),
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

function setFlow(host: Host, move: Move, link: HostLink = host) {
  return callHostActions(
    { action: "set_flow", code: link.code, key: link.key, move },
    { user: host.user },
  );
}

/** Makes the moves in order, each of which must be allowed. */
async function moves(host: Host, ...list: Move[]): Promise<void> {
  for (const move of list) {
    const response = await setFlow(host, move);
    expect(response.status, JSON.stringify(move)).toBe(200);
  }
}

const startQuiz: Move = { type: "start_module", module: "quiz" };
const open: Move = { type: "open" };
const reveal: Move = { type: "reveal" };
const next: Move = { type: "next_step" };
const stop: Move = { type: "stop_module" };

/** Plays one question: open, reveal, next. */
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

function quizAt(step: number, phase = "idle") {
  return { status: "live", current_module: "quiz", current_step: step, phase };
}

/** The positions of the event's questions that count as played. */
function playedPositions(eventId: string): number[] {
  return sql(
    `select position from public.quiz_questions ` +
      `where event_id = '${eventId}' and revealed_at is not null order by position`,
  ).map(Number);
}

describe("start_module for the quiz", () => {
  it("starts at the first question of a fresh quiz", async () => {
    const host = await createQuiz(3);

    const response = await setFlow(host, startQuiz);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "live",
      currentModule: "quiz",
      currentStep: 0,
      phase: "idle",
    });
    expect(await flowOf(host)).toEqual(quizAt(0));
  });

  it("resumes at the first unplayed question after a stop", async () => {
    const host = await createQuiz(4);
    await moves(host, startQuiz, ...play, ...play, stop);

    const response = await setFlow(host, startQuiz);

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(quizAt(2));
  });

  it("resumes at a question that was opened but never revealed", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, ...play, open, stop);

    await moves(host, startQuiz);

    expect(await flowOf(host)).toEqual(quizAt(1));
  });

  it("answers module_empty for a quiz without questions", async () => {
    const host = await createQuiz(0);

    const response = await setFlow(host, startQuiz);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_empty" });
    expect((await flowOf(host)).status).toBe("lobby");
  });

  it("answers module_finished once every question was played", async () => {
    const host = await createQuiz(2);
    await moves(host, startQuiz, ...play, ...play, stop);

    const response = await setFlow(host, startQuiz);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_finished" });
    expect(await flowOf(host)).toEqual({
      ...quizAt(0),
      current_module: null,
    });
  });

  it("still starts another activity without questions as before", async () => {
    const host = await createQuiz(0);

    await moves(host, { type: "start_module", module: "awards" });

    expect((await flowOf(host)).current_module).toBe("awards");
  });
});

describe("the results step", () => {
  it("next_step after the last question moves to step = number of questions", async () => {
    const host = await createQuiz(2);
    await moves(host, startQuiz, ...play, open, reveal);

    const response = await setFlow(host, next);

    expect(response.status).toBe(200);
    expect(await flowOf(host)).toEqual(quizAt(2));
  });

  it.each([open, reveal, next])(
    "refuses $type on the results step",
    async (move) => {
      const host = await createQuiz(1);
      await moves(host, startQuiz, ...play);

      const response = await setFlow(host, move);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "invalid_transition" });
      expect(await flowOf(host)).toEqual(quizAt(1));
    },
  );

  it("stop_module goes back to the party screen", async () => {
    const host = await createQuiz(1);
    await moves(host, startQuiz, ...play);

    await moves(host, stop);

    expect(await flowOf(host)).toEqual({
      ...quizAt(0),
      current_module: null,
    });
  });
});

describe("set_flow for the quiz without the right key", () => {
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
    const host = await createQuiz(2);

    const response = await setFlow(host, startQuiz, link(host));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect((await flowOf(host)).status).toBe("lobby");
  });

  it("refuses a wrong key for an empty quiz the same way", async () => {
    const host = await createQuiz(0);

    const response = await setFlow(host, startQuiz, {
      code: host.code,
      key: otherKey(host.key),
    });

    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("a reveal marks the question as played", () => {
  it("sets the revealed time of the current question, and only that one", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, ...play, open);
    expect(playedPositions(host.eventId)).toEqual([0]);

    await moves(host, reveal);

    expect(playedPositions(host.eventId)).toEqual([0, 1]);
  });

  it("leaves skipped and opened questions unplayed", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, next, open);

    expect(playedPositions(host.eventId)).toEqual([]);
  });

  it("never changes the time of a question revealed earlier", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(cast.event.id, 0, { revealed: true });
    const before = revealedAt(cast.event.id);

    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "quiz",
      current_step: 0,
      phase: "open",
    });
    await setEventFlow(cast.event.id, { phase: "revealed" });

    expect(revealedAt(cast.event.id)).toBe(before);
  });

  it("marks nothing when another activity reveals a step", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz", "awards"] });
    await seedQuizQuestion(cast.event.id, 0);

    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "awards",
      current_step: 0,
      phase: "open",
    });
    await setEventFlow(cast.event.id, { phase: "revealed" });

    expect(playedPositions(cast.event.id)).toEqual([]);
  });

  it("marks nothing when the flow write is refused", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(cast.event.id, 0);
    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "quiz",
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
    expect(playedPositions(cast.event.id)).toEqual([]);
  });

  function revealedAt(eventId: string): string | undefined {
    return sql(
      `select revealed_at from public.quiz_questions where event_id = '${eventId}'`,
    )[0];
  }
});

describe("what guests and the TV read while the host runs the quiz", () => {
  async function joinedQuiz(count: number) {
    const host = await createQuiz(count);
    const [guest, tv] = [await anonymousUser(), await anonymousUser()];
    await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });
    await tv.client.rpc("join_tv", { code: host.code });
    return { host, viewers: [guest, tv] };
  }

  async function readsOf(viewer: User, eventId: string) {
    const questions = await viewer.client
      .from("quiz_questions")
      .select("id, position")
      .eq("event_id", eventId)
      .order("position");
    const ids = (questions.data ?? []).map((q) => q.id);
    const keys = await viewer.client
      .from("quiz_answer_keys")
      .select("question_id, correct")
      .in("question_id", ids);
    return {
      positions: (questions.data ?? []).map((q) => q.position),
      keys: (keys.data ?? []).length,
    };
  }

  it("nothing before the question opens, the question once open, its key once revealed", async () => {
    const { host, viewers } = await joinedQuiz(2);

    await moves(host, startQuiz);
    for (const viewer of viewers) {
      expect(await readsOf(viewer, host.eventId)).toEqual({
        positions: [],
        keys: 0,
      });
    }

    await moves(host, open);
    for (const viewer of viewers) {
      expect(await readsOf(viewer, host.eventId)).toEqual({
        positions: [0],
        keys: 0,
      });
    }

    await moves(host, reveal);
    for (const viewer of viewers) {
      expect(await readsOf(viewer, host.eventId)).toEqual({
        positions: [0],
        keys: 1,
      });
    }

    await moves(host, next);
    for (const viewer of viewers) {
      expect(await readsOf(viewer, host.eventId)).toEqual({
        positions: [0],
        keys: 1,
      });
    }
  });
});

describe("quiz_progress", () => {
  async function progressOf(client: User["client"], eventId: string) {
    const { data, error } = await client.rpc("quiz_progress", {
      target_event_id: eventId,
    });
    expect(error).toBeNull();
    return data;
  }

  it("gives every member the number of approved questions and how many are played", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(cast.event.id, 0, { revealed: true });
    await seedQuizQuestion(cast.event.id, 1, { revealed: true });
    await seedQuizQuestion(cast.event.id, 2);
    await seedQuizQuestion(cast.event.id, 3, { status: "draft" });

    for (const member of [cast.host, cast.guestA, cast.tv]) {
      expect(await progressOf(member.client, cast.event.id)).toEqual([
        { total: 3, played: 2 },
      ]);
    }
  });

  it("counts zero for a quiz without questions", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });

    expect(await progressOf(cast.guestA.client, cast.event.id)).toEqual([
      { total: 0, played: 0 },
    ]);
  });

  it("follows the host's reveals", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, ...play, open, reveal);

    expect(await progressOf(host.user.client, host.eventId)).toEqual([
      { total: 3, played: 2 },
    ]);
  });

  it("gives non-members and the host of another event nothing", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(cast.event.id, 0, { revealed: true });

    for (const outsider of [cast.nonMember, cast.otherHost]) {
      expect(await progressOf(outsider.client, cast.event.id)).toEqual([]);
    }
  });

  it("can't be called without a session", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });

    const { data, error } = await signedOutClient().rpc("quiz_progress", {
      target_event_id: cast.event.id,
    });

    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501");
  });

  it("gives nothing for an expired event", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(cast.event.id, 0);
    await serviceClient()
      .from("events")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", cast.event.id);

    expect(await progressOf(cast.guestA.client, cast.event.id)).toEqual([]);
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
