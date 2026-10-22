// #53: quiz questions and their answer keys. Nobody but the host reads a
// question before it is shown or a key before its reveal, non-members read
// nothing, and no client writes either table.
import { beforeAll, describe, expect, it } from "vitest";
import {
  expireEvent,
  seedCast,
  seedQuizQuestion,
  serviceClient,
  setEventFlow,
  signedOutClient,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** The question ids by position 0 to 3; 3 is a draft. */
let ids: string[];

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "awards"] });
  ids = [
    await seedQuizQuestion(cast.event.id, 0, { correct: 0 }),
    await seedQuizQuestion(cast.event.id, 1, { correct: 1 }),
    await seedQuizQuestion(cast.event.id, 2, { correct: 2 }),
    await seedQuizQuestion(cast.event.id, 3, { status: "draft" }),
  ];
  await seedQuizQuestion(cast.otherEvent.id, 0);
});

const viewerRoles = ["guestA", "guestB", "tv"] as const;
const outsiderRoles = ["nonMember", "otherHost"] as const;
const allRoles = [
  "host",
  "guestA",
  "guestB",
  "tv",
  "nonMember",
  "otherHost",
] as const;

function user(role: (typeof allRoles)[number]): User {
  return cast[role];
}

/** The positions of the event's questions the user can read. */
async function positionsOf(who: User): Promise<number[]> {
  const { data, error } = await who.client
    .from("quiz_questions")
    .select("position")
    .eq("event_id", cast.event.id)
    .order("position");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.position);
}

/** The right options the user can read, by question position. */
async function keysOf(who: User): Promise<Record<number, number>> {
  const { data, error } = await who.client
    .from("quiz_answer_keys")
    .select("question_id, correct")
    .in("question_id", ids);
  expect(error).toBeNull();
  const keys: Record<number, number> = {};
  for (const row of data ?? [])
    keys[ids.indexOf(row.question_id)] = row.correct;
  return keys;
}

type Flow = Parameters<typeof setEventFlow>[1];

/** Sets the event's flow and which positions count as revealed. */
async function setFlow(flow: Flow, revealed: number[] = []) {
  await setEventFlow(cast.event.id, {
    status: "lobby",
    current_module: null,
    current_step: 0,
    phase: "idle",
    ...flow,
  });
  const service = serviceClient();
  await service
    .from("quiz_questions")
    .update({ revealed_at: null })
    .eq("event_id", cast.event.id);
  for (const position of revealed) {
    await service
      .from("quiz_questions")
      .update({ revealed_at: new Date().toISOString() })
      .eq("event_id", cast.event.id)
      .eq("position", position);
  }
}

const quizOn = (step: number, phase: Flow["phase"]): Flow => ({
  status: "live",
  current_module: "quiz",
  current_step: step,
  phase,
});

describe("the host", () => {
  it("reads every question and every key of their event, drafts included", async () => {
    await setFlow({});
    expect(await positionsOf(cast.host)).toEqual([0, 1, 2, 3]);
    expect(await keysOf(cast.host)).toMatchObject({ 0: 0, 1: 1, 2: 2 });
  });

  it("reads the text and options of a question", async () => {
    const { data } = await cast.host.client
      .from("quiz_questions")
      .select("text, options, status, revealed_at, answer_count")
      .eq("id", ids[0] as string)
      .single();
    expect(data).toEqual({
      text: "Question 1?",
      options: ["Ett", "Två", "Tre", "Fyra"],
      status: "approved",
      revealed_at: null,
      answer_count: 0,
    });
  });

  it("does not read the questions of another event", async () => {
    const { data } = await cast.otherHost.client
      .from("quiz_questions")
      .select("event_id");
    expect(data).toEqual([{ event_id: cast.otherEvent.id }]);
  });
});

describe.each(viewerRoles)("the %s", (role) => {
  it("reads no question and no key before the quiz shows one", async () => {
    await setFlow({});
    expect(await positionsOf(user(role))).toEqual([]);
    expect(await keysOf(user(role))).toEqual({});
  });

  it("reads no question while another activity runs on that step", async () => {
    await setFlow({ ...quizOn(0, "open"), current_module: "awards" });
    expect(await positionsOf(user(role))).toEqual([]);
  });

  it("reads a question while the quiz shows it, but not its key", async () => {
    await setFlow(quizOn(1, "open"));
    expect(await positionsOf(user(role))).toEqual([1]);
    expect(await keysOf(user(role))).toEqual({});
  });

  it("reads no question of an idle phase", async () => {
    await setFlow(quizOn(2, "idle"));
    expect(await positionsOf(user(role))).toEqual([]);
  });

  it("reads the key only once the reveal is recorded on the question", async () => {
    await setFlow(quizOn(1, "revealed"));
    expect(await positionsOf(user(role))).toEqual([1]);
    expect(await keysOf(user(role))).toEqual({});

    await setFlow(quizOn(1, "revealed"), [1]);
    expect(await keysOf(user(role))).toEqual({ 1: 1 });
  });

  it("keeps reading a played question and its key after the quiz moves on", async () => {
    await setFlow(quizOn(2, "open"), [0, 1]);
    expect(await positionsOf(user(role))).toEqual([0, 1, 2]);
    expect(await keysOf(user(role))).toEqual({ 0: 0, 1: 1 });
  });

  it("never reads a draft question, shown or revealed", async () => {
    await setFlow(quizOn(3, "open"), [3]);
    expect(await positionsOf(user(role))).not.toContain(3);
    expect(await keysOf(user(role))).not.toHaveProperty("3");
  });
});

describe.each(outsiderRoles)("the %s", (role) => {
  it("reads no question and no key of the event, even when revealed", async () => {
    await setFlow(quizOn(1, "revealed"), [0, 1]);
    expect(await positionsOf(user(role))).toEqual([]);
    expect(await keysOf(user(role))).toEqual({});
  });
});

it("a browser without a session reads nothing", async () => {
  await setFlow(quizOn(1, "revealed"), [0, 1, 2]);
  const client = signedOutClient();
  const questions = await client.from("quiz_questions").select();
  const keys = await client.from("quiz_answer_keys").select();
  expect(questions.data ?? []).toEqual([]);
  expect(keys.data ?? []).toEqual([]);
});

describe("writing", () => {
  /** Both tables as the service role sees them, to check nothing changed. */
  async function snapshot() {
    const service = serviceClient();
    const questions = await service
      .from("quiz_questions")
      .select()
      .eq("event_id", cast.event.id)
      .order("position");
    const keys = await service
      .from("quiz_answer_keys")
      .select()
      .in("question_id", ids)
      .order("question_id");
    return { questions: questions.data, keys: keys.data };
  }

  it.each(allRoles)("the %s can't add a question", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_questions")
      .insert({
        event_id: cast.event.id,
        position: 9,
        text: "Sneaky?",
        options: ["a", "b", "c", "d"],
      });
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't change a question", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_questions")
      .update({ text: "Changed", revealed_at: new Date().toISOString() })
      .eq("event_id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't delete a question", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_questions")
      .delete()
      .eq("event_id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't add an answer key", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_answer_keys")
      .insert({ question_id: ids[3] as string, correct: 0 });
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't change an answer key", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_answer_keys")
      .update({ correct: 3 })
      .in("question_id", ids);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't delete an answer key", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("quiz_answer_keys")
      .delete()
      .in("question_id", ids);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });
});

describe("the tables' own checks", () => {
  const base = { position: 20, text: "Ok?", options: ["a", "b", "c", "d"] };
  const bad: [string, Record<string, unknown>][] = [
    ["a negative position", { position: -1 }],
    ["a 31st question", { position: 30 }],
    ["empty text", { text: "" }],
    ["blank text", { text: "   " }],
    ["too long text", { text: "x".repeat(201) }],
    ["three options", { options: ["a", "b", "c"] }],
    ["five options", { options: ["a", "b", "c", "d", "e"] }],
    ["an empty option", { options: ["a", "", "c", "d"] }],
    ["a too long option", { options: ["a", "b", "c", "x".repeat(81)] }],
    ["a null option", { options: ["a", null, "c", "d"] }],
    ["an unknown status", { status: "pending" }],
    ["a negative answer count", { answer_count: -1 }],
  ];

  it.each(bad)("refuse %s", async (_, change) => {
    const { error } = await serviceClient()
      .from("quiz_questions")
      .insert({
        event_id: cast.otherEvent.id,
        ...base,
        ...change,
      } as never);
    expect(error).not.toBeNull();
  });

  it("refuse a second question at the same position", async () => {
    const { error } = await serviceClient()
      .from("quiz_questions")
      .insert({ event_id: cast.event.id, ...base, position: 0 });
    expect(error?.code).toBe("23505");
  });

  it("refuse a right option outside 0-3", async () => {
    const id = await seedQuizQuestion(cast.otherEvent.id, 25);
    for (const correct of [-1, 4]) {
      const { error } = await serviceClient()
        .from("quiz_answer_keys")
        .update({ correct })
        .eq("question_id", id);
      expect(error).not.toBeNull();
    }
  });
});

describe("deleting", () => {
  it("removes questions and keys with their event", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    const id = await seedQuizQuestion(own.event.id, 0);
    await serviceClient().from("events").delete().eq("id", own.event.id);

    const questions = await serviceClient()
      .from("quiz_questions")
      .select()
      .eq("id", id);
    const keys = await serviceClient()
      .from("quiz_answer_keys")
      .select()
      .eq("question_id", id);
    expect(questions.data).toEqual([]);
    expect(keys.data).toEqual([]);
  });

  it("makes an expired event's questions unreachable, even for its host", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    await seedQuizQuestion(own.event.id, 0, { revealed: true });
    await expireEvent(own.event.id);

    for (const who of [own.host, own.guestA]) {
      const { data } = await who.client.from("quiz_questions").select();
      expect(data).toEqual([]);
    }
  });
});
