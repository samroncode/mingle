// #56: scores and results. One point per right answer on played questions;
// ties share a place; scores follow the member through a rename; a late guest
// has 0 for what they missed. The host reads every guest at any time, a guest
// their own row and (once the quiz is finished) the top 3 places, the TV the
// top 3 places once finished, and non-members nothing.
import { getQuizScores } from "../../src/api/quiz";
import { placeCases } from "../../src/lib/quiz/places.cases";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  seedCast,
  seedEvent,
  seedMember,
  seedQuizQuestion,
  serviceClient,
  setEventFlow,
  signedOutClient,
  type Cast,
  type User,
} from "./helpers";

/** What a viewer reads: [display name, score, place] in the order returned. */
async function scoresFor(who: User, eventId: string) {
  const result = await getQuizScores(eventId, who.client);
  expect(result.ok).toBe(true);
  if (!result.ok) return [];
  return result.value.map((s) => [s.displayName, s.score, s.place]);
}

/** Records an answer with the service role, as a guest would have given it. */
async function giveAnswer(
  eventId: string,
  questionId: string,
  userId: string,
  chosen: number,
) {
  const { error } = await serviceClient().from("quiz_answers").insert({
    question_id: questionId,
    event_id: eventId,
    user_id: userId,
    chosen,
  });
  if (error) throw error;
}

async function reveal(questionId: string) {
  const { error } = await serviceClient()
    .from("quiz_questions")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", questionId);
  if (error) throw error;
}

describe("scores with ties, a late guest and a rename", () => {
  let cast: Cast;
  let guestC: User;
  let late: User;
  /** Question ids by position 0 to 3; all have the right option 1. */
  let ids: string[];

  beforeAll(async () => {
    cast = await seedCast({ enabled_modules: ["quiz"] });
    [guestC, late] = await anonymousUsers(2);
    await seedMember(cast.event.id, guestC.id, "guest", "Cecilia");
    ids = [];
    for (let position = 0; position < 4; position++) {
      ids.push(await seedQuizQuestion(cast.event.id, position, { correct: 1 }));
    }
    await setEventFlow(cast.event.id, {
      status: "live",
      current_module: "quiz",
      current_step: 0,
      phase: "idle",
    });
    // Anna and Bertil get 3 right, Cecilia 1; question 4 is not played yet.
    for (const [user, chosens] of [
      [cast.guestA, [1, 1, 1, 1]],
      [cast.guestB, [1, 1, 1, 0]],
      [guestC, [1, 0, 0, 1]],
    ] as const) {
      for (const [i, chosen] of chosens.entries()) {
        await giveAnswer(cast.event.id, ids[i] as string, user.id, chosen);
      }
    }
    for (const id of ids.slice(0, 3)) await reveal(id);
    // Dennis joins after question 3: no answers, so 0.
    await seedMember(cast.event.id, late.id, "guest", "Dennis");
  });

  it("counts right answers of played questions, and ties share a place", async () => {
    // Anna's right answer on the unplayed question 4 is not counted.
    expect(await scoresFor(cast.host, cast.event.id)).toEqual([
      ["Anna", 3, 1],
      ["Bertil", 3, 1],
      ["Cecilia", 1, 3],
      ["Dennis", 0, 4],
    ]);
  });

  it("gives a guest their own row before the quiz is finished, and no one else's", async () => {
    expect(await scoresFor(cast.guestA, cast.event.id)).toEqual([
      ["Anna", 3, 1],
    ]);
    expect(await scoresFor(late, cast.event.id)).toEqual([["Dennis", 0, 4]]);
  });

  it("gives the TV, non-members and other hosts nothing before it is finished", async () => {
    for (const who of [cast.tv, cast.nonMember, cast.otherHost]) {
      expect(await scoresFor(who, cast.event.id)).toEqual([]);
    }
  });

  it("gives the top 3 places to the TV and the guests once every question is played", async () => {
    await reveal(ids[3] as string);
    // Anna now has 4, Bertil 3, Cecilia 2.
    const top3 = [
      ["Anna", 4, 1],
      ["Bertil", 3, 2],
      ["Cecilia", 2, 3],
    ];
    expect(await scoresFor(cast.tv, cast.event.id)).toEqual(top3);
    expect(await scoresFor(cast.guestB, cast.event.id)).toEqual(top3);
    // Dennis is outside the top 3, so he gets it plus his own row.
    expect(await scoresFor(late, cast.event.id)).toEqual([
      ...top3,
      ["Dennis", 0, 4],
    ]);
    expect(await scoresFor(cast.host, cast.event.id)).toEqual([
      ...top3,
      ["Dennis", 0, 4],
    ]);
  });

  it("still gives non-members nothing once finished", async () => {
    for (const who of [cast.nonMember, cast.otherHost]) {
      expect(await scoresFor(who, cast.event.id)).toEqual([]);
    }
    expect(await scoresFor(cast.host, cast.otherEvent.id)).toEqual([]);
  });

  it("keeps a guest's score when they rename", async () => {
    const { error } = await serviceClient()
      .from("members")
      .update({ display_name: "Cissi" })
      .eq("event_id", cast.event.id)
      .eq("user_id", guestC.id);
    expect(error).toBeNull();
    const rows = await scoresFor(cast.host, cast.event.id);
    expect(rows).toContainEqual(["Cissi", 2, 3]);
    expect(rows).not.toContainEqual(["Cecilia", 2, 3]);
  });

  it("is not callable without a session", async () => {
    const { data } = await signedOutClient().rpc("quiz_scores", {
      target_event_id: cast.event.id,
    });
    expect(data ?? []).toEqual([]);
  });
});

describe("a quiz that is not finished", () => {
  it("gives the top 3 to nobody while it has no questions", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    expect(await scoresFor(own.tv, own.event.id)).toEqual([]);
    expect(await scoresFor(own.host, own.event.id)).toEqual([
      ["Anna", 0, 1],
      ["Bertil", 0, 1],
    ]);
  });

  it("does not count a draft question", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    const draft = await seedQuizQuestion(own.event.id, 0, {
      status: "draft",
      correct: 1,
    });
    await giveAnswer(own.event.id, draft, own.guestA.id, 1);
    await reveal(draft);
    expect(await scoresFor(own.host, own.event.id)).toEqual([
      ["Anna", 0, 1],
      ["Bertil", 0, 1],
    ]);
  });

  it("does not count a played question of another event", async () => {
    const own = await seedCast({ enabled_modules: ["quiz"] });
    const other = await seedQuizQuestion(own.otherEvent.id, 0, { correct: 1 });
    await reveal(other);
    expect(await scoresFor(own.otherHost, own.otherEvent.id)).toEqual([]);
    expect(await scoresFor(own.host, own.event.id)).toEqual([
      ["Anna", 0, 1],
      ["Bertil", 0, 1],
    ]);
  });
});

describe("places agree with the app's places", () => {
  it.each(placeCases.filter((c) => c.scores.length > 0))(
    "places $scores as $places",
    async ({ scores, places }) => {
      const event = await seedEvent({ enabled_modules: ["quiz"] });
      const host = await anonymousUser();
      await seedMember(event.id, host.id, "host");
      const guests = await Promise.all(scores.map(() => anonymousUser()));
      const best = Math.max(...scores);
      const questions: string[] = [];
      for (let position = 0; position < best; position++) {
        questions.push(
          await seedQuizQuestion(event.id, position, {
            correct: 1,
            revealed: true,
          }),
        );
      }
      for (const [i, guest] of guests.entries()) {
        await seedMember(event.id, guest.id, "guest", `Guest ${i}`);
        for (const [q, id] of questions.entries()) {
          const right = q < (scores[i] as number);
          await giveAnswer(event.id, id, guest.id, right ? 1 : 0);
        }
      }
      const rows = await scoresFor(host, event.id);
      const byName = new Map(rows.map(([name, , place]) => [name, place]));
      expect(scores.map((_, i) => byName.get(`Guest ${i}`))).toEqual(places);
    },
  );
});
