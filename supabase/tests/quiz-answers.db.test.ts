// #55: guests answer. A guest writes only their own answer, only while the
// quiz is open on that question; the host reads every answer, a guest only
// their own, the TV and non-members none; the question counts new answers;
// votes per option come only after the reveal and only to members.
import {
  answerQuizQuestion,
  getQuizVotes,
  listQuizAnswerers,
} from "../../src/api/quiz";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  seedCast,
  seedQuizQuestion,
  serviceClient,
  setEventFlow,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** Question ids by position 0 to 2 in the event; 2 is a draft. */
let ids: string[];
/** A question of the other event, at position 0. */
let otherQuestionId: string;

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "awards"] });
  ids = [
    await seedQuizQuestion(cast.event.id, 0, { correct: 0 }),
    await seedQuizQuestion(cast.event.id, 1, { correct: 1 }),
    await seedQuizQuestion(cast.event.id, 2, { status: "draft" }),
  ];
  otherQuestionId = await seedQuizQuestion(cast.otherEvent.id, 0);
  await serviceClient()
    .from("events")
    .update({ enabled_modules: ["quiz"] })
    .eq("id", cast.otherEvent.id);
  await setEventFlow(cast.otherEvent.id, quizOn(0, "open"));
});

type Flow = Parameters<typeof setEventFlow>[1];

const quizOn = (step: number, phase: "idle" | "open" | "revealed"): Flow => ({
  status: "live",
  current_module: "quiz",
  current_step: step,
  phase,
});

beforeEach(async () => {
  const service = serviceClient();
  await service.from("quiz_answers").delete().eq("event_id", cast.event.id);
  await service
    .from("quiz_questions")
    .update({ revealed_at: null, answer_count: 0 })
    .eq("event_id", cast.event.id);
  await setEventFlow(cast.event.id, quizOn(0, "open"));
});

/** Inserts an answer row; the fields default to a valid answer by the user. */
function answer(
  who: User,
  fields: Partial<{
    question_id: string;
    event_id: string;
    user_id: string;
    chosen: number;
  }> = {},
) {
  return who.client.from("quiz_answers").insert({
    question_id: ids[0] as string,
    event_id: cast.event.id,
    user_id: who.id,
    chosen: 2,
    ...fields,
  });
}

/** What the service role sees: every answer of the event as [user, chosen]. */
async function storedAnswers(questionId: string) {
  const { data, error } = await serviceClient()
    .from("quiz_answers")
    .select("user_id, chosen")
    .eq("question_id", questionId);
  expect(error).toBeNull();
  return (data ?? []).map((row) => [row.user_id, row.chosen]);
}

async function countOf(questionId: string): Promise<number | undefined> {
  const { data } = await cast.host.client
    .from("quiz_questions")
    .select("answer_count")
    .eq("id", questionId)
    .single();
  return data?.answer_count;
}

describe("a guest answering", () => {
  it("inserts and changes their own answer while the question is open", async () => {
    const first = await answer(cast.guestA);
    expect(first.error).toBeNull();
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 2],
    ]);

    const change = await cast.guestA.client
      .from("quiz_answers")
      .update({ chosen: 3 })
      .eq("question_id", ids[0] as string)
      .eq("user_id", cast.guestA.id)
      .select();
    expect(change.error).toBeNull();
    expect(change.data).toHaveLength(1);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 3],
    ]);
  });

  it("answers only once per question", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    const again = await answer(cast.guestA, { chosen: 1 });
    expect(again.error?.code).toBe("23505");
  });

  it("can only pick an option from 0 to 3", async () => {
    for (const chosen of [-1, 4]) {
      const result = await answer(cast.guestA, { chosen });
      expect(result.error?.code).toBe("23514");
    }
  });

  it("is refused while the question is not open yet or is revealed", async () => {
    for (const phase of ["idle", "revealed"] as const) {
      await setEventFlow(cast.event.id, quizOn(0, phase));
      const result = await answer(cast.guestA);
      expect(result.error?.code, phase).toBe("42501");
    }
    expect(await storedAnswers(ids[0] as string)).toEqual([]);
  });

  it("is refused on a question that is not the current one", async () => {
    const result = await answer(cast.guestA, { question_id: ids[1] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused on a draft question", async () => {
    await setEventFlow(cast.event.id, quizOn(2, "open"));
    const result = await answer(cast.guestA, { question_id: ids[2] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused while another activity runs", async () => {
    await setEventFlow(cast.event.id, {
      ...quizOn(0, "open"),
      current_module: "awards",
    });
    expect((await answer(cast.guestA)).error?.code).toBe("42501");
  });

  it("is refused when the event is not live", async () => {
    await setEventFlow(cast.event.id, {
      status: "lobby",
      current_module: null,
      current_step: 0,
      phase: "idle",
    });
    expect((await answer(cast.guestA)).error?.code).toBe("42501");
  });

  it("is refused for a question of another event", async () => {
    const result = await answer(cast.guestA, { question_id: otherQuestionId });
    expect(result.error).not.toBeNull();
    const asOther = await answer(cast.guestA, {
      question_id: otherQuestionId,
      event_id: cast.otherEvent.id,
    });
    expect(asOther.error?.code).toBe("42501");
    expect(await storedAnswers(otherQuestionId)).toEqual([]);
  });

  it("is refused for another guest's row", async () => {
    const result = await answer(cast.guestA, { user_id: cast.guestB.id });
    expect(result.error?.code).toBe("42501");
    expect(await storedAnswers(ids[0] as string)).toEqual([]);
  });

  it("cannot change another guest's answer", async () => {
    expect((await answer(cast.guestB, { chosen: 1 })).error).toBeNull();
    const result = await cast.guestA.client
      .from("quiz_answers")
      .update({ chosen: 0 })
      .eq("user_id", cast.guestB.id)
      .select();
    expect(result.data ?? []).toEqual([]);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestB.id, 1],
    ]);
  });

  it("cannot change their answer after the reveal", async () => {
    expect((await answer(cast.guestA, { chosen: 1 })).error).toBeNull();
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    const result = await cast.guestA.client
      .from("quiz_answers")
      .update({ chosen: 0 })
      .eq("user_id", cast.guestA.id)
      .select();
    expect(result.data ?? []).toEqual([]);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 1],
    ]);
  });

  it("cannot move their answer to another question, event or user", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    const changes = [
      { question_id: ids[1] as string },
      { event_id: cast.otherEvent.id },
      { user_id: cast.guestB.id },
    ];
    for (const change of changes) {
      const result = await cast.guestA.client
        .from("quiz_answers")
        .update(change)
        .eq("user_id", cast.guestA.id);
      expect(result.error?.code, JSON.stringify(change)).toBe("42501");
    }
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 2],
    ]);
  });

  it("cannot delete an answer", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    const result = await cast.guestA.client
      .from("quiz_answers")
      .delete()
      .eq("user_id", cast.guestA.id);
    expect(result.error?.code).toBe("42501");
    expect(await storedAnswers(ids[0] as string)).toHaveLength(1);
  });
});

describe.each(["tv", "host", "nonMember", "otherHost"] as const)(
  "the %s",
  (role) => {
    it("cannot answer", async () => {
      const result = await answer(cast[role]);
      expect(result.error?.code).toBe("42501");
      expect(await storedAnswers(ids[0] as string)).toEqual([]);
    });
  },
);

it("a browser without a session cannot answer or read", async () => {
  const client = signedOutClient();
  const result = await client.from("quiz_answers").insert({
    question_id: ids[0] as string,
    event_id: cast.event.id,
    user_id: cast.guestA.id,
    chosen: 0,
  });
  expect(result.error).not.toBeNull();
  const read = await client.from("quiz_answers").select();
  expect(read.data ?? []).toEqual([]);
});

describe("reading answers", () => {
  beforeEach(async () => {
    expect((await answer(cast.guestA, { chosen: 1 })).error).toBeNull();
    expect((await answer(cast.guestB, { chosen: 3 })).error).toBeNull();
  });

  async function readBy(who: User) {
    const { data, error } = await who.client
      .from("quiz_answers")
      .select("user_id, chosen");
    expect(error).toBeNull();
    return (data ?? []).map((row) => [row.user_id, row.chosen]).sort();
  }

  it("lets the host read every answer of their event", async () => {
    expect(await readBy(cast.host)).toEqual(
      [
        [cast.guestA.id, 1],
        [cast.guestB.id, 3],
      ].sort(),
    );
  });

  it("lets a guest read only their own answer, also after the reveal", async () => {
    expect(await readBy(cast.guestA)).toEqual([[cast.guestA.id, 1]]);
    expect(await readBy(cast.guestB)).toEqual([[cast.guestB.id, 3]]);
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    expect(await readBy(cast.guestA)).toEqual([[cast.guestA.id, 1]]);
  });

  it.each(["tv", "nonMember", "otherHost"] as const)(
    "lets the %s read none",
    async (role) => {
      expect(await readBy(cast[role])).toEqual([]);
    },
  );
});

describe("the answer count", () => {
  it("counts each guest's first answer and not a changed one", async () => {
    expect(await countOf(ids[0] as string)).toBe(0);
    await answer(cast.guestA);
    expect(await countOf(ids[0] as string)).toBe(1);
    await cast.guestA.client
      .from("quiz_answers")
      .update({ chosen: 0 })
      .eq("user_id", cast.guestA.id);
    expect(await countOf(ids[0] as string)).toBe(1);
    await answer(cast.guestB);
    expect(await countOf(ids[0] as string)).toBe(2);
  });

  it("is read by every member through the question, with no answers", async () => {
    await answer(cast.guestA);
    for (const who of [cast.guestB, cast.tv, cast.host]) {
      const { data } = await who.client
        .from("quiz_questions")
        .select("answer_count")
        .eq("id", ids[0] as string)
        .single();
      expect(data?.answer_count).toBe(1);
    }
  });

  it("is not changed by a refused answer", async () => {
    await answer(cast.guestA, { question_id: ids[1] as string });
    await answer(cast.tv);
    expect(await countOf(ids[0] as string)).toBe(0);
    expect(await countOf(ids[1] as string)).toBe(0);
  });

  it("cannot be set by a client", async () => {
    for (const who of [cast.host, cast.guestA]) {
      const result = await who.client
        .from("quiz_questions")
        .update({ answer_count: 99 })
        .eq("id", ids[0] as string);
      expect(result.error?.code).toBe("42501");
    }
  });
});

describe("votes per option", () => {
  async function votes(who: User, questionId: string = ids[0] as string) {
    const { data, error } = await who.client.rpc("quiz_votes", {
      target_question_id: questionId,
    });
    expect(error).toBeNull();
    return (data ?? []).map((row) => [row.option, row.votes]);
  }

  beforeEach(async () => {
    await answer(cast.guestA, { chosen: 1 });
    await answer(cast.guestB, { chosen: 1 });
  });

  it("gives nothing to anyone before the reveal", async () => {
    for (const who of [cast.host, cast.guestA, cast.tv]) {
      expect(await votes(who)).toEqual([]);
    }
  });

  it("gives the count per option to every member after the reveal", async () => {
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    const expected = [
      [0, 0],
      [1, 2],
      [2, 0],
      [3, 0],
    ];
    for (const who of [cast.host, cast.guestA, cast.guestB, cast.tv]) {
      expect(await votes(who)).toEqual(expected);
    }
  });

  it("keeps giving them after the quiz moves on", async () => {
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    await setEventFlow(cast.event.id, quizOn(1, "open"));
    expect(await votes(cast.guestA)).toEqual([
      [0, 0],
      [1, 2],
      [2, 0],
      [3, 0],
    ]);
  });

  it.each(["nonMember", "otherHost"] as const)(
    "gives nothing to the %s, even after the reveal",
    async (role) => {
      await setEventFlow(cast.event.id, quizOn(0, "revealed"));
      expect(await votes(cast[role])).toEqual([]);
    },
  );

  it("gives nothing for an unknown question", async () => {
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    const unknown = "00000000-0000-0000-0000-000000000000";
    expect(await votes(cast.host, unknown)).toEqual([]);
  });

  it("gives nothing for a question of another event", async () => {
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    expect(await votes(cast.host, otherQuestionId)).toEqual([]);
  });

  it("is not callable without a session", async () => {
    const { data } = await signedOutClient().rpc("quiz_votes", {
      target_question_id: ids[0] as string,
    });
    expect(data ?? []).toEqual([]);
  });
});

describe("deleting", () => {
  it("removes a guest's answers with their membership", async () => {
    await answer(cast.guestB);
    await serviceClient()
      .from("members")
      .delete()
      .eq("event_id", cast.event.id)
      .eq("user_id", cast.guestB.id);
    expect(await storedAnswers(ids[0] as string)).toEqual([]);
    // Put the guest back for the other tests.
    await serviceClient().from("members").insert({
      event_id: cast.event.id,
      user_id: cast.guestB.id,
      role: "guest",
      display_name: "Bertil",
    });
  });

  it("removes the answers with their event", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    const questionId = await seedQuizQuestion(own.event.id, 0);
    await setEventFlow(own.event.id, quizOn(0, "open"));
    const result = await own.guestA.client.from("quiz_answers").insert({
      question_id: questionId,
      event_id: own.event.id,
      user_id: own.guestA.id,
      chosen: 0,
    });
    expect(result.error).toBeNull();
    await serviceClient().from("events").delete().eq("id", own.event.id);
    const [left] = sql(
      `select count(*) from public.quiz_answers where question_id = '${questionId}'`,
    );
    expect(left).toBe("0");
  });
});

describe("the data layer", () => {
  const give = (who: User, chosen: number, questionId = ids[0] as string) =>
    answerQuizQuestion(
      { eventId: cast.event.id, questionId, userId: who.id, chosen },
      who.client,
    );

  it("saves an answer, changes it, and counts it once", async () => {
    expect(await give(cast.guestA, 1)).toEqual({ ok: true, value: null });
    expect(await give(cast.guestA, 3)).toEqual({ ok: true, value: null });
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 3],
    ]);
    expect(await countOf(ids[0] as string)).toBe(1);
  });

  it("says question_closed after the reveal, with or without an answer", async () => {
    await give(cast.guestA, 1);
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    expect(await give(cast.guestA, 2)).toEqual({
      ok: false,
      error: "question_closed",
    });
    expect(await give(cast.guestB, 2)).toEqual({
      ok: false,
      error: "question_closed",
    });
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, 1],
    ]);
  });

  it("lets the host list who answered, and nothing else about the answers", async () => {
    await give(cast.guestA, 1);
    await give(cast.guestB, 0);
    const result = await listQuizAnswerers(ids[0] as string, cast.host.client);
    expect(result.ok && result.value.sort()).toEqual(
      [cast.guestA.id, cast.guestB.id].sort(),
    );
  });

  it("gives votes only once revealed", async () => {
    await give(cast.guestA, 2);
    expect(await getQuizVotes(ids[0] as string, cast.tv.client)).toEqual({
      ok: false,
      error: "not_revealed",
    });
    await setEventFlow(cast.event.id, quizOn(0, "revealed"));
    expect(await getQuizVotes(ids[0] as string, cast.tv.client)).toEqual({
      ok: true,
      value: [0, 0, 1, 0],
    });
  });
});
