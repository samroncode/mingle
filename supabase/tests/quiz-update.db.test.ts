// #57: host-actions `update_quiz`, the host replacing the unplayed quiz
// questions during the evening. Called over HTTP through `supabase functions
// serve`; the questions are read back through the host's normal client.
import { describe, expect, it } from "vitest";
import { anonymousUser, signedOutClient, sql, type User } from "./helpers";
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
type Question = { text: string; options: string[]; correct: number };

const options = ["Ett", "Två", "Tre", "Fyra"];

function questions(count: number, prefix = "Question"): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `${prefix} ${i + 1}?`,
    options,
    correct: i % 4,
  }));
}

/** Creates an event with `count` quiz questions through host-actions. */
async function createQuiz(
  count: number,
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
      ...(count > 0 ? { quiz: questions(count) } : {}),
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

function updateQuiz(
  host: Host,
  list: unknown,
  link: HostLink = host,
  user: User = host.user,
) {
  return callHostActions(
    { action: "update_quiz", code: link.code, key: link.key, questions: list },
    { user },
  );
}

const startQuiz: Move = { type: "start_module", module: "quiz" };
const open: Move = { type: "open" };
const reveal: Move = { type: "reveal" };
const next: Move = { type: "next_step" };
const stop: Move = { type: "stop_module" };
const play: Move[] = [open, reveal, next];

type Stored = Question & { position: number; revealedAt: string | null };

/** The event's questions in order, as the host reads them. */
async function quizOf(host: Host): Promise<Stored[]> {
  const { data, error } = await host.user.client
    .from("quiz_questions")
    .select("position, text, options, revealed_at, quiz_answer_keys(correct)")
    .eq("event_id", host.eventId)
    .order("position");
  if (error) throw error;
  return data.map((row) => ({
    position: row.position,
    text: row.text,
    options: row.options,
    correct: row.quiz_answer_keys?.correct ?? -1,
    revealedAt: row.revealed_at,
  }));
}

/** What the host reads, without the positions and reveal times. */
async function textsOf(host: Host): Promise<Question[]> {
  return (await quizOf(host)).map(({ text, options, correct }) => ({
    text,
    options,
    correct,
  }));
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

describe("update_quiz before the quiz starts", () => {
  it("replaces every question in the order sent and answers {}", async () => {
    const host = await createQuiz(3);
    const list = questions(4, "New");

    const response = await updateQuiz(host, list);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    const stored = await quizOf(host);
    expect(stored.map((q) => q.position)).toEqual([0, 1, 2, 3]);
    expect(await textsOf(host)).toEqual(list);
  });

  it("removes every question with an empty list", async () => {
    const host = await createQuiz(3);

    expect((await updateQuiz(host, [])).status).toBe(200);
    expect(await quizOf(host)).toEqual([]);
  });

  it("adds questions to an event that had none", async () => {
    const host = await createQuiz(0);

    expect((await updateQuiz(host, questions(2))).status).toBe(200);
    expect(await textsOf(host)).toEqual(questions(2));
  });

  it("takes 30 questions", async () => {
    const host = await createQuiz(1);

    expect((await updateQuiz(host, questions(30))).status).toBe(200);
    expect(await quizOf(host)).toHaveLength(30);
  });

  it("refuses more than 30 with invalid_request and changes nothing", async () => {
    const host = await createQuiz(3);

    const response = await updateQuiz(host, questions(31));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(questions(3));
  });

  it("never returns the key", async () => {
    const host = await createQuiz(1);
    expect((await updateQuiz(host, questions(2))).text).not.toContain(host.key);
  });
});

describe("update_quiz after some questions are played", () => {
  it("keeps the played questions and replaces the rest after them", async () => {
    const host = await createQuiz(4);
    await moves(host, startQuiz, ...play, ...play, stop);
    const before = await quizOf(host);
    const list = questions(3, "New");

    const response = await updateQuiz(host, list);

    expect(response.status).toBe(200);
    const after = await quizOf(host);
    expect(after.slice(0, 2)).toEqual(before.slice(0, 2));
    expect(after.slice(2).map((q) => q.position)).toEqual([2, 3, 4]);
    expect((await textsOf(host)).slice(2)).toEqual(list);
    expect(after.slice(2).every((q) => q.revealedAt === null)).toBe(true);
  });

  it("works between questions while the quiz runs, and the quiz goes on at the first new one", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, ...play);
    const list = questions(2, "New");

    expect((await updateQuiz(host, list)).status).toBe(200);

    expect(await stepOf(host)).toBe(1);
    await moves(host, open);
    const { data } = await host.user.client
      .from("quiz_questions")
      .select("text")
      .eq("event_id", host.eventId)
      .eq("position", 1)
      .single();
    expect(data?.text).toBe("New 1?");
  });

  it("works on the party screen while the quiz is stopped", async () => {
    const host = await createQuiz(2);
    await moves(host, startQuiz, ...play, stop);

    expect((await updateQuiz(host, questions(1, "New"))).status).toBe(200);
    await moves(host, startQuiz);
    expect(await stepOf(host)).toBe(1);
  });

  it("puts a skipped question's played neighbours first, so steps stay in order", async () => {
    const host = await createQuiz(3);
    // Skips question 1, plays question 2.
    await moves(host, startQuiz, next, ...play, stop);

    expect((await updateQuiz(host, questions(1, "New"))).status).toBe(200);

    const after = await quizOf(host);
    expect(after.map((q) => [q.position, q.text])).toEqual([
      [0, "Question 2?"],
      [1, "New 1?"],
    ]);
    expect(after[0]?.revealedAt).not.toBeNull();
    await moves(host, startQuiz);
    expect(await stepOf(host)).toBe(1);
  });

  it("keeps the answers to played questions, so scores stay the same", async () => {
    const host = await createQuiz(2);
    const guest = await anonymousUser();
    await guest.client.rpc("join_event", {
      code: host.code,
      display_name: "Anna",
    });
    await moves(host, startQuiz, open);
    const [questionId = ""] = sql(
      `select id from public.quiz_questions ` +
        `where event_id = '${host.eventId}' and position = 0`,
    );
    // Question 1's right option is 0.
    const answer = await guest.client.from("quiz_answers").insert({
      question_id: questionId,
      event_id: host.eventId,
      user_id: guest.id,
      chosen: 0,
    });
    expect(answer.error).toBeNull();
    await moves(host, reveal, next);

    expect((await updateQuiz(host, questions(2, "New"))).status).toBe(200);

    const { data } = await host.user.client.rpc("quiz_scores", {
      target_event_id: host.eventId,
    });
    expect(data?.map((row) => row.score)).toEqual([1]);
  });

  it("counts the played questions in the limit of 30", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, ...play, ...play, stop);

    const over = await updateQuiz(host, questions(29));
    expect(over.status).toBe(400);
    expect(over.body).toEqual({ error: "invalid_request" });
    expect(await quizOf(host)).toHaveLength(3);

    expect((await updateQuiz(host, questions(28))).status).toBe(200);
    expect(await quizOf(host)).toHaveLength(30);
  });
});

describe("update_quiz refused by the flow", () => {
  async function expectRefused(host: Host, error = "invalid_transition") {
    const before = await quizOf(host);
    const response = await updateQuiz(host, questions(2, "New"));
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error });
    expect(await quizOf(host)).toEqual(before);
  }

  it("refuses while a question is open", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, open);
    await expectRefused(host);
  });

  it("refuses while a question is revealed", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, open, reveal);
    await expectRefused(host);
  });

  it("refuses once the event has ended", async () => {
    const host = await createQuiz(3);
    await moves(host, { type: "end_event" });
    await expectRefused(host);
  });

  it("refuses once every question is played, so the quiz stays finished", async () => {
    const host = await createQuiz(2);
    await moves(host, startQuiz, ...play, ...play);
    await expectRefused(host);
    await moves(host, stop);
    await expectRefused(host);
  });

  it("refuses questions for an event with the quiz switched off", async () => {
    const host = await createQuiz(0, ["awards"]);
    await expectRefused(host, "module_disabled");
  });

  it("a flow move after the update is checked against the new state", async () => {
    const host = await createQuiz(3);
    await moves(host, startQuiz, next);
    await updateQuiz(host, questions(2, "New"));

    // The quiz moved back to step 0, the first new question.
    expect(await stepOf(host)).toBe(0);
    expect((await setFlow(host, open)).status).toBe(200);
  });
});

describe("update_quiz: invalid questions", () => {
  it.each<[string, unknown]>([
    ["an empty question", [{ text: "  ", options, correct: 0 }]],
    [
      "a question that is too long",
      [{ text: "x".repeat(201), options, correct: 0 }],
    ],
    ["three options", [{ text: "Q?", options: ["A", "B", "C"], correct: 0 }]],
    [
      "an empty option",
      [{ text: "Q?", options: ["A", "", "C", "D"], correct: 0 }],
    ],
    ["a right option out of range", [{ text: "Q?", options, correct: 4 }]],
    ["an unknown field", [{ text: "Q?", options, correct: 0, revealed: true }]],
    ["questions that aren't a list", { text: "Q?", options, correct: 0 }],
    ["no questions at all", undefined],
  ])("refuses %s with invalid_request and changes nothing", async (_, list) => {
    const host = await createQuiz(2);

    const response = await updateQuiz(host, list);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual(questions(2));
  });
});

describe("update_quiz without the right key", () => {
  async function expectRefused(host: Host, link: HostLink, user?: User) {
    const response = await updateQuiz(host, questions(1, "New"), link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await textsOf(host)).toEqual(questions(2));
  }

  it("refuses a wrong key", async () => {
    const host = await createQuiz(2);
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createQuiz(2), createQuiz(2)]);
    await expectRefused(host, { code: host.code, key: other.key });
    expect(await textsOf(other)).toEqual(questions(2));
  });

  it("refuses an unknown code", async () => {
    const host = await createQuiz(2);
    await expectRefused(host, { code: unusedCode(), key: host.key });
  });

  it("refuses an expired event", async () => {
    const host = await createQuiz(2);
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );

    const response = await updateQuiz(host, questions(1, "New"));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(
      sql(
        `select text from public.quiz_questions ` +
          `where event_id = '${host.eventId}' order by position`,
      ),
    ).toEqual(["Question 1?", "Question 2?"]);
  });
});

describe("rate limit on update_quiz", () => {
  const limit = 10;

  it(`allows ${limit} updates per user and event, then refuses`, async () => {
    const host = await createQuiz(2);
    for (let i = 0; i < limit; i++) {
      expect((await updateQuiz(host, questions(2))).status).toBe(200);
    }

    const response = await updateQuiz(host, questions(1, "New"));

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await textsOf(host)).toEqual(questions(2));
  });

  it("counts under update_quiz and the event's id, after the key check", async () => {
    const host = await createQuiz(2);
    await updateQuiz(host, questions(2), {
      code: host.code,
      key: otherKey(host.key),
    });
    await updateQuiz(host, questions(2));

    expect(
      sql(
        `select action, count from private.rate_limits ` +
          `where user_id = '${host.user.id}' and action like 'update_quiz%'`,
      ),
    ).toEqual([`update_quiz:${host.eventId}|1`]);
  });

  it("counts each event on its own", async () => {
    const host = await createQuiz(2);
    for (let i = 0; i < limit; i++) await updateQuiz(host, questions(2));
    const second = await createQuiz(2);

    const response = await updateQuiz(second, questions(1), second, host.user);

    expect(response.status).toBe(200);
  });
});

describe("update_quiz_questions outside host-actions", () => {
  it("no client role can call it", async () => {
    const host = await createQuiz(2);
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
      const { error } = await client.rpc("update_quiz_questions", {
        target_event_id: host.eventId,
        questions: questions(1, "New"),
      });
      expect(error?.code).toBe("42501");
    }
    expect(await textsOf(host)).toEqual(questions(2));
  });
});
