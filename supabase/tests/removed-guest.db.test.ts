// Host control panel spec (#75), ticket #80: what the database does for a
// removed guest and for everyone else once a guest is removed. The removal
// itself is made with the service role through `remove_guest`; the HTTP side
// (key, rate limit, error codes) is in remove-guest.db.test.ts.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  seedAwardCategory,
  seedCast,
  seedHotTake,
  seedQuizQuestion,
  serviceClient,
  setEventFlow,
  setEventStatus,
  sql,
  type Cast,
  type User,
} from "./helpers";

/** Removes a guest the way host-actions does, once its key check has passed. */
async function remove(cast: Cast, who: User): Promise<string> {
  const { data, error } = await serviceClient().rpc("remove_guest", {
    target_event_id: cast.event.id,
    target_user_id: who.id,
  });
  expect(error).toBeNull();
  return data as string;
}

/** A cast whose first guest, Anna, has been removed. */
async function castWithAnnaRemoved(): Promise<Cast> {
  const cast = await seedCast({
    enabled_modules: ["quiz", "awards", "hottakes"],
  });
  expect(await remove(cast, cast.guestA)).toBe("removed");
  return cast;
}

async function openQuestion(cast: Cast, revealed = false): Promise<string> {
  const id = await seedQuizQuestion(cast.event.id, 0, { revealed });
  await setEventFlow(cast.event.id, {
    status: "live",
    current_module: "quiz",
    current_step: 0,
    phase: "open",
  });
  return id;
}

describe("a removed guest", () => {
  it("reads no event, members, items or results", async () => {
    const cast = await seedCast({
      enabled_modules: ["quiz", "awards", "hottakes"],
    });
    const questionId = await seedQuizQuestion(cast.event.id, 0, {
      revealed: true,
    });
    const categoryId = await seedAwardCategory(cast.event.id, 0, {
      revealed: true,
    });
    const takeId = await seedHotTake(cast.event.id, 0, { revealed: true });
    const before = await cast.guestA.client.from("events").select("id");
    expect(before.data).toHaveLength(1);

    expect(await remove(cast, cast.guestA)).toBe("removed");

    const anna = cast.guestA.client;
    expect((await anna.from("events").select("id")).data).toEqual([]);
    expect((await anna.from("members").select("user_id")).data).toEqual([]);
    expect((await anna.from("quiz_questions").select("id")).data).toEqual([]);
    expect((await anna.from("award_categories").select("id")).data).toEqual([]);
    expect((await anna.from("hot_takes").select("id")).data).toEqual([]);
    expect(
      (await anna.rpc("is_member", { target_event_id: cast.event.id })).data,
    ).toBe(false);
    expect(
      (await anna.rpc("quiz_votes", { target_question_id: questionId })).data,
    ).toEqual([]);
    expect(
      (await anna.rpc("quiz_scores", { target_event_id: cast.event.id })).data,
    ).toEqual([]);
    expect(
      (await anna.rpc("award_winners", { target_category_id: categoryId }))
        .data,
    ).toEqual([]);
    expect(
      (await anna.rpc("award_results", { target_event_id: cast.event.id }))
        .data,
    ).toEqual([]);
    expect(
      (await anna.rpc("hot_take_result", { target_hot_take_id: takeId })).data,
    ).toEqual([]);
    expect(
      (
        await anna.rpc("hot_take_highlights", {
          target_event_id: cast.event.id,
        })
      ).data,
    ).toEqual([]);
  });

  it("can't answer a quiz question, vote or answer a hot take", async () => {
    const cast = await seedCast({
      enabled_modules: ["quiz", "awards", "hottakes"],
    });
    const questionId = await seedQuizQuestion(cast.event.id, 0);
    const categoryId = await seedAwardCategory(cast.event.id, 0);
    const takeId = await seedHotTake(cast.event.id, 0);
    const flow = (module: string) =>
      setEventFlow(cast.event.id, {
        status: "live",
        current_module: module,
        current_step: 0,
        phase: "open",
      });
    expect(await remove(cast, cast.guestA)).toBe("removed");
    const anna = cast.guestA;

    await flow("quiz");
    const quiz = await anna.client.from("quiz_answers").insert({
      question_id: questionId,
      event_id: cast.event.id,
      user_id: anna.id,
      chosen: 1,
    });
    await flow("awards");
    const vote = await anna.client.from("award_votes").insert({
      category_id: categoryId,
      event_id: cast.event.id,
      voter_id: anna.id,
      voted_for_id: cast.guestB.id,
    });
    await flow("hottakes");
    const take = await anna.client.from("hot_take_answers").insert({
      hot_take_id: takeId,
      event_id: cast.event.id,
      guest_id: anna.id,
      agree: true,
    });

    for (const { error } of [quiz, vote, take]) {
      expect(error?.code).toBe("42501");
    }
    expect(
      sql(
        `select count(*) from public.quiz_answers where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["0"]);
    expect(
      sql(
        `select count(*) from public.award_votes where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["0"]);
    expect(
      sql(
        `select count(*) from public.hot_take_answers where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["0"]);
  });

  it("can't be voted for", async () => {
    const cast = await seedCast({ enabled_modules: ["awards"] });
    const categoryId = await seedAwardCategory(cast.event.id, 0);
    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "awards",
      current_step: 0,
      phase: "open",
    });
    expect(await remove(cast, cast.guestA)).toBe("removed");

    const { error } = await cast.guestB.client.from("award_votes").insert({
      category_id: categoryId,
      event_id: cast.event.id,
      voter_id: cast.guestB.id,
      voted_for_id: cast.guestA.id,
    });

    expect(error?.code).toBe("42501");
  });

  it("can't rename themselves", async () => {
    const cast = await castWithAnnaRemoved();

    const { data } = await cast.guestA.client
      .from("members")
      .update({ display_name: "Annika" })
      .eq("user_id", cast.guestA.id)
      .select();

    expect(data).toEqual([]);
    expect(
      sql(
        `select display_name from public.members where user_id = '${cast.guestA.id}'`,
      ),
    ).toEqual(["Anna"]);
  });

  it("is told `removed` by both join functions, whatever name they send", async () => {
    const cast = await castWithAnnaRemoved();

    for (const name of ["Anna", "Annika", "Someone new", "", "   "]) {
      const { data } = await cast.guestA.client.rpc("join_event", {
        code: cast.event.code,
        display_name: name,
      });
      expect(data).toEqual({ event_id: null, error: "removed" });
    }
    const tv = await cast.guestA.client.rpc("join_tv", {
      code: cast.event.code,
    });
    expect(tv.data).toEqual({ event_id: null, error: "removed" });
    expect(
      sql(
        `select count(*) from public.members where user_id = '${cast.guestA.id}' and role <> 'guest'`,
      ),
    ).toEqual(["0"]);
  });

  it("is still told `removed` after the event has ended", async () => {
    const cast = await castWithAnnaRemoved();
    await setEventStatus(cast.event.id, "ended");

    const { data } = await cast.guestA.client.rpc("join_event", {
      code: cast.event.code,
      display_name: "Anna",
    });

    expect(data).toEqual({ event_id: null, error: "removed" });
  });

  it("is told `removed` only for the event they were removed from", async () => {
    const cast = await castWithAnnaRemoved();

    const { data } = await cast.guestA.client.rpc("join_event", {
      code: cast.otherEvent.code,
      display_name: "Anna",
    });

    expect(data).toEqual({ event_id: cast.otherEvent.id, error: null });
  });
});

describe("no client can set the removed time", () => {
  it("refuses a guest, the host, the TV and a signed-out client", async () => {
    const cast = await seedCast();
    const stamp = new Date().toISOString();

    for (const who of [cast.guestA, cast.host, cast.tv]) {
      const { error } = await who.client
        .from("members")
        .update({ removed_at: stamp })
        .eq("event_id", cast.event.id)
        .select();
      expect(error?.code).toBe("42501");
    }
    expect(
      sql(
        `select count(*) from public.members where event_id = '${cast.event.id}' and removed_at is not null`,
      ),
    ).toEqual(["0"]);
  });

  it("refuses an insert with a removed time", async () => {
    const cast = await seedCast();
    const stranger = await anonymousUser();

    const { error } = await stranger.client.from("members").insert({
      event_id: cast.event.id,
      user_id: stranger.id,
      role: "guest",
      display_name: "Sneaky",
      removed_at: new Date().toISOString(),
    });

    expect(error).not.toBeNull();
  });
});

describe("everyone else after a removal", () => {
  it("doesn't see the removed guest's row, and the name is free again", async () => {
    const cast = await castWithAnnaRemoved();

    for (const who of [cast.host, cast.guestB, cast.tv]) {
      const { data } = await who.client
        .from("members")
        .select("display_name")
        .eq("event_id", cast.event.id)
        .eq("role", "guest");
      expect(data?.map((row) => row.display_name)).toEqual(["Bertil"]);
    }
    const newcomer = await anonymousUser();
    const joined = await newcomer.client.rpc("join_event", {
      code: cast.event.code,
      display_name: "anna",
    });
    expect(joined.data).toEqual({ event_id: cast.event.id, error: null });
  });

  it("keeps a still-removed guest's row for the join check", async () => {
    const cast = await castWithAnnaRemoved();

    expect(
      sql(
        `select removed_at is not null from public.members where user_id = '${cast.guestA.id}'`,
      ),
    ).toEqual(["t"]);
  });

  it("still sees the host, the TV and the other guest as before", async () => {
    const cast = await castWithAnnaRemoved();

    const { data } = await cast.guestB.client
      .from("members")
      .select("role")
      .eq("event_id", cast.event.id);

    expect(data?.map((row) => row.role).sort()).toEqual([
      "guest",
      "host",
      "tv",
    ]);
  });
});

describe("removing a guest deletes what they gave on unrevealed items", () => {
  it("deletes quiz answers on unrevealed questions and updates the count", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    const played = await seedQuizQuestion(cast.event.id, 0, { revealed: true });
    const open = await seedQuizQuestion(cast.event.id, 1);
    const service = serviceClient();
    for (const question of [played, open]) {
      for (const who of [cast.guestA, cast.guestB]) {
        const { error } = await service.from("quiz_answers").insert({
          question_id: question,
          event_id: cast.event.id,
          user_id: who.id,
          chosen: 1,
        });
        expect(error).toBeNull();
      }
    }

    expect(await remove(cast, cast.guestA)).toBe("removed");

    expect(
      sql(
        `select question_id = '${open}', user_id = '${cast.guestB.id}' from public.quiz_answers where question_id = '${open}'`,
      ),
    ).toEqual(["t|t"]);
    expect(
      sql(
        `select count(*) from public.quiz_answers where question_id = '${played}'`,
      ),
    ).toEqual(["2"]);
    expect(
      sql(
        `select id = '${open}', answer_count from public.quiz_questions where event_id = '${cast.event.id}' order by position`,
      ),
    ).toEqual(["f|2", "t|1"]);
  });

  it("deletes hot take answers on unrevealed hot takes and updates the count", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    const played = await seedHotTake(cast.event.id, 0, { revealed: true });
    const open = await seedHotTake(cast.event.id, 1);
    const service = serviceClient();
    for (const take of [played, open]) {
      for (const who of [cast.guestA, cast.guestB]) {
        const { error } = await service.from("hot_take_answers").insert({
          hot_take_id: take,
          event_id: cast.event.id,
          guest_id: who.id,
          agree: true,
        });
        expect(error).toBeNull();
      }
    }

    expect(await remove(cast, cast.guestA)).toBe("removed");

    expect(
      sql(
        `select count(*) from public.hot_take_answers where hot_take_id = '${played}'`,
      ),
    ).toEqual(["2"]);
    expect(
      sql(
        `select guest_id from public.hot_take_answers where hot_take_id = '${open}'`,
      ),
    ).toEqual([cast.guestB.id]);
    expect(
      sql(
        `select answer_count from public.hot_takes where event_id = '${cast.event.id}' order by position`,
      ),
    ).toEqual(["2", "1"]);
  });

  it("deletes votes by the guest and for the guest on unrevealed categories", async () => {
    const cast = await seedCast({ enabled_modules: ["awards"] });
    const played = await seedAwardCategory(cast.event.id, 0, {
      revealed: true,
    });
    const open = await seedAwardCategory(cast.event.id, 1);
    const service = serviceClient();
    for (const category of [played, open]) {
      for (const [voter, pick] of [
        [cast.guestA, cast.guestB],
        [cast.guestB, cast.guestA],
      ] as const) {
        const { error } = await service.from("award_votes").insert({
          category_id: category,
          event_id: cast.event.id,
          voter_id: voter.id,
          voted_for_id: pick.id,
        });
        expect(error).toBeNull();
      }
    }

    expect(await remove(cast, cast.guestA)).toBe("removed");

    expect(
      sql(
        `select count(*) from public.award_votes where category_id = '${played}'`,
      ),
    ).toEqual(["2"]);
    expect(
      sql(
        `select count(*) from public.award_votes where category_id = '${open}'`,
      ),
    ).toEqual(["0"]);
    expect(
      sql(
        `select vote_count from public.award_categories where event_id = '${cast.event.id}' order by position`,
      ),
    ).toEqual(["2", "0"]);
  });

  it("leaves the other guest's answers and the other event alone", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    const question = await seedQuizQuestion(cast.event.id, 0);
    const otherQuestion = await seedQuizQuestion(cast.otherEvent.id, 0);
    const service = serviceClient();
    await service.from("quiz_answers").insert([
      {
        question_id: question,
        event_id: cast.event.id,
        user_id: cast.guestB.id,
        chosen: 2,
      },
      {
        question_id: question,
        event_id: cast.event.id,
        user_id: cast.guestA.id,
        chosen: 1,
      },
    ]);
    await service.from("quiz_answers").insert({
      question_id: otherQuestion,
      event_id: cast.otherEvent.id,
      user_id: cast.otherHost.id,
      chosen: 0,
    });

    expect(await remove(cast, cast.guestA)).toBe("removed");

    expect(
      sql(
        `select user_id from public.quiz_answers where event_id = '${cast.event.id}'`,
      ),
    ).toEqual([cast.guestB.id]);
    expect(
      sql(
        `select count(*) from public.quiz_answers where event_id = '${cast.otherEvent.id}'`,
      ),
    ).toEqual(["1"]);
  });

  it("changes nothing when the removal is refused", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    const question = await seedQuizQuestion(cast.event.id, 0);
    await serviceClient().from("quiz_answers").insert({
      question_id: question,
      event_id: cast.event.id,
      user_id: cast.guestA.id,
      chosen: 1,
    });
    await setEventStatus(cast.event.id, "ended");

    expect(await remove(cast, cast.guestA)).toBe("ended");

    expect(
      sql(
        `select count(*) from public.quiz_answers where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["1"]);
    expect(
      sql(
        `select removed_at is null from public.members where user_id = '${cast.guestA.id}'`,
      ),
    ).toEqual(["t"]);
  });
});

describe("results leave a removed guest out", () => {
  it("leaves them out of the quiz scores and the top 3", async () => {
    const cast = await seedCast({ enabled_modules: ["quiz"] });
    const question = await seedQuizQuestion(cast.event.id, 0, {
      revealed: true,
      correct: 1,
    });
    await serviceClient()
      .from("quiz_answers")
      .insert([
        {
          question_id: question,
          event_id: cast.event.id,
          user_id: cast.guestA.id,
          chosen: 1,
        },
        {
          question_id: question,
          event_id: cast.event.id,
          user_id: cast.guestB.id,
          chosen: 1,
        },
      ]);

    expect(await remove(cast, cast.guestA)).toBe("removed");

    const asHost = await cast.host.client.rpc("quiz_scores", {
      target_event_id: cast.event.id,
    });
    expect(
      asHost.data?.map((row) => [row.display_name, row.score, row.place]),
    ).toEqual([["Bertil", 1, 1]]);
    const asTv = await cast.tv.client.rpc("quiz_scores", {
      target_event_id: cast.event.id,
    });
    expect(asTv.data?.map((row) => row.display_name)).toEqual(["Bertil"]);
  });

  it("leaves them out of the award winners and the end list", async () => {
    const cast = await seedCast({ enabled_modules: ["awards"] });
    const category = await seedAwardCategory(cast.event.id, 0, {
      revealed: true,
    });
    await serviceClient()
      .from("award_votes")
      .insert([
        {
          category_id: category,
          event_id: cast.event.id,
          voter_id: cast.guestB.id,
          voted_for_id: cast.guestA.id,
        },
      ]);

    expect(await remove(cast, cast.guestA)).toBe("removed");

    const winners = await cast.guestB.client.rpc("award_winners", {
      target_category_id: category,
    });
    expect(winners.data).toEqual([]);
    const end = await cast.tv.client.rpc("award_results", {
      target_event_id: cast.event.id,
    });
    expect(end.data?.map((row) => row.user_id)).toEqual([null]);
    const tally = await cast.host.client.rpc("award_tally", {
      target_category_id: category,
    });
    expect(tally.data?.map((row) => row.user_id)).toEqual([cast.guestB.id]);
    const won = await cast.host.client.rpc("awards_won", {
      target_event_id: cast.event.id,
    });
    expect(won.data?.map((row) => row.user_id)).toEqual([cast.guestB.id]);
  });

  it("leaves their answers out of the hot take split", async () => {
    const cast = await seedCast({ enabled_modules: ["hottakes"] });
    const take = await seedHotTake(cast.event.id, 0, { revealed: true });
    await serviceClient()
      .from("hot_take_answers")
      .insert([
        {
          hot_take_id: take,
          event_id: cast.event.id,
          guest_id: cast.guestA.id,
          agree: true,
        },
        {
          hot_take_id: take,
          event_id: cast.event.id,
          guest_id: cast.guestB.id,
          agree: false,
        },
      ]);

    expect(await remove(cast, cast.guestA)).toBe("removed");

    const split = await cast.tv.client.rpc("hot_take_result", {
      target_hot_take_id: take,
    });
    expect(split.data).toEqual([{ agree_count: 0, disagree_count: 1 }]);
  });
});

describe("a quiz question that opens after the removal", () => {
  it("still lets the others answer", async () => {
    const cast = await castWithAnnaRemoved();
    const question = await openQuestion(cast);

    const { error } = await cast.guestB.client.from("quiz_answers").insert({
      question_id: question,
      event_id: cast.event.id,
      user_id: cast.guestB.id,
      chosen: 1,
    });

    expect(error).toBeNull();
  });
});
