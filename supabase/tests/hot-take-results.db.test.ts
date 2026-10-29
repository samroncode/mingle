// #73: splits and highlights. After a reveal every member reads the agree and
// disagree counts of a hot take; the summary names the most divisive and the
// most agreed hot take; a guest reads how often they sided with the majority.
// Nothing is readable before the reveal or by a non-member, and answers from
// someone who is no longer a guest with a name don't count.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  anonymousUsers,
  seedCast,
  seedHotTake,
  seedMember,
  serviceClient,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/// Joined late; a guest like the others.
let carl: User;
let dora: User;
/// Hot takes by position 0 to 3; 3 is a draft.
let ids: string[];
let otherTakeId: string;

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["hottakes"] });
  [carl, dora] = await anonymousUsers(2);
  await seedMember(cast.event.id, carl.id, "guest", "Carl");
  await seedMember(cast.event.id, dora.id, "guest", "Dora");
  ids = [
    await seedHotTake(cast.event.id, 0),
    await seedHotTake(cast.event.id, 1),
    await seedHotTake(cast.event.id, 2),
    await seedHotTake(cast.event.id, 3, { status: "draft" }),
  ];
  otherTakeId = await seedHotTake(cast.otherEvent.id, 0, { revealed: true });
});

beforeEach(async () => {
  const service = serviceClient();
  await service.from("hot_take_answers").delete().eq("event_id", cast.event.id);
  await service
    .from("hot_takes")
    .update({ revealed_at: null })
    .eq("event_id", cast.event.id);
});

const id = (position: number) => ids[position] as string;

async function reveal(...positions: number[]) {
  for (const position of positions) {
    await serviceClient()
      .from("hot_takes")
      .update({ revealed_at: new Date().toISOString() })
      .eq("id", id(position));
  }
}

/** Service-role answer rows as [guest, agree] pairs on a position. */
async function answers(position: number, pairs: Array<[User, boolean]>) {
  const { error } = await serviceClient()
    .from("hot_take_answers")
    .insert(
      pairs.map(([guest, agree]) => ({
        hot_take_id: id(position),
        event_id: cast.event.id,
        guest_id: guest.id,
        agree,
      })),
    );
  expect(error).toBeNull();
}

async function result(who: User, takeId: string) {
  const { data, error } = await who.client.rpc("hot_take_result", {
    target_hot_take_id: takeId,
  });
  expect(error).toBeNull();
  return (data ?? []).map((r) => [r.agree_count, r.disagree_count]);
}

async function highlights(who: User) {
  const { data, error } = await who.client.rpc("hot_take_highlights", {
    target_event_id: cast.event.id,
  });
  expect(error).toBeNull();
  return (data ?? []).map((r) => [
    r.highlight,
    r.hot_take_position,
    r.agree_count,
    r.disagree_count,
  ]);
}

async function majority(who: User) {
  const { data, error } = await who.client.rpc("my_hot_take_majority", {
    target_event_id: cast.event.id,
  });
  expect(error).toBeNull();
  return (data ?? []).map((r) => [r.sided, r.answered]);
}

describe("the split of a hot take", () => {
  it("is the agree and disagree counts, for every member", async () => {
    await answers(0, [
      [cast.guestA, true],
      [cast.guestB, true],
      [carl, false],
    ]);
    await reveal(0);
    for (const who of [cast.host, cast.guestA, cast.guestB, carl, cast.tv]) {
      expect(await result(who, id(0))).toEqual([[2, 1]]);
    }
  });

  it("is an exact 50/50 when the room is split evenly", async () => {
    await answers(0, [
      [cast.guestA, true],
      [cast.guestB, false],
    ]);
    await reveal(0);
    expect(await result(cast.tv, id(0))).toEqual([[1, 1]]);
  });

  it("is 0 and 0 when nobody answered", async () => {
    await reveal(0);
    expect(await result(cast.guestA, id(0))).toEqual([[0, 0]]);
  });

  it("follows a guest who renamed, and counts a guest who joined late", async () => {
    await answers(0, [
      [cast.guestA, true],
      [carl, true],
    ]);
    await reveal(0);
    const rename = await serviceClient()
      .from("members")
      .update({ display_name: "Anna A" })
      .eq("user_id", cast.guestA.id);
    expect(rename.error).toBeNull();
    expect(await result(cast.tv, id(0))).toEqual([[2, 0]]);
  });

  it("does not count an answer from a guest who became the host", async () => {
    const [leaver] = await anonymousUsers(1);
    await seedMember(cast.event.id, leaver.id, "guest", "Lena");
    try {
      await answers(0, [
        [cast.guestA, true],
        [leaver, false],
      ]);
      await reveal(0);
      // What claim_host does to a guest who opens the host link.
      const claimed = await serviceClient()
        .from("members")
        .update({ role: "host", display_name: null })
        .eq("event_id", cast.event.id)
        .eq("user_id", leaver.id);
      expect(claimed.error).toBeNull();
      expect(await result(cast.tv, id(0))).toEqual([[1, 0]]);
    } finally {
      await serviceClient()
        .from("members")
        .delete()
        .eq("event_id", cast.event.id)
        .eq("user_id", leaver.id);
    }
  });
});

describe("before the reveal and for outsiders", () => {
  it("gives nothing before the reveal, to anyone", async () => {
    await answers(0, [[cast.guestA, true]]);
    for (const who of [cast.host, cast.guestA, cast.guestB, cast.tv]) {
      expect(await result(who, id(0))).toEqual([]);
      expect(await highlights(who)).toEqual([]);
      expect(await majority(who)).toEqual(
        who === cast.guestA || who === cast.guestB ? [[0, 0]] : [],
      );
    }
  });

  it("gives nothing for a draft hot take", async () => {
    await reveal(3);
    expect(await result(cast.host, id(3))).toEqual([]);
    expect(await highlights(cast.host)).toEqual([]);
  });

  it("gives non-members and a member of another event nothing", async () => {
    await answers(0, [[cast.guestA, true]]);
    await reveal(0);
    for (const who of [cast.nonMember, cast.otherHost]) {
      expect(await result(who, id(0))).toEqual([]);
      expect(await highlights(who)).toEqual([]);
      expect(await majority(who)).toEqual([]);
    }
  });

  it("is refused for signed-out users", async () => {
    const anon = signedOutClient();
    for (const [name, args] of [
      ["hot_take_result", { target_hot_take_id: id(0) }],
      ["hot_take_highlights", { target_event_id: cast.event.id }],
      ["my_hot_take_majority", { target_event_id: cast.event.id }],
    ] as const) {
      const response = await anon.rpc(name, args as never);
      expect(response.error, name).not.toBeNull();
    }
  });

  it("does not leak a hot take of another event to its own members", async () => {
    expect(await result(cast.otherHost, otherTakeId)).toEqual([[0, 0]]);
    expect(await result(cast.guestA, otherTakeId)).toEqual([]);
  });
});

describe("the highlights", () => {
  it("name the most divisive and the most agreed hot take with their splits", async () => {
    await answers(0, [
      [cast.guestA, true],
      [cast.guestB, true],
      [carl, true],
      [dora, false],
    ]);
    await answers(1, [
      [cast.guestA, true],
      [cast.guestB, false],
      [carl, true],
      [dora, false],
    ]);
    await answers(2, [
      [cast.guestA, false],
      [cast.guestB, false],
    ]);
    await reveal(0, 1, 2);
    for (const who of [cast.host, cast.guestA, cast.tv]) {
      expect(await highlights(who)).toEqual([
        ["agreed", 2, 0, 2],
        ["divisive", 1, 2, 2],
      ]);
    }
  });

  it("compare shares, not counts", async () => {
    await answers(0, [
      [cast.guestA, true],
      [cast.guestB, true],
      [carl, true],
      [dora, false],
    ]);
    await answers(1, [
      [cast.guestA, true],
      [cast.guestB, false],
    ]);
    await reveal(0, 1);
    expect(await highlights(cast.tv)).toEqual([
      ["agreed", 0, 3, 1],
      ["divisive", 1, 1, 1],
    ]);
  });

  it("go to the lower position on a tie", async () => {
    for (const position of [0, 1]) {
      await answers(position, [
        [cast.guestA, true],
        [cast.guestB, false],
      ]);
    }
    await reveal(0, 1);
    expect(await highlights(cast.tv)).toEqual([
      ["agreed", 0, 1, 1],
      ["divisive", 0, 1, 1],
    ]);
  });

  it("leave out hot takes without answers, and are empty when none had any", async () => {
    await reveal(0, 1, 2);
    expect(await highlights(cast.tv)).toEqual([]);
    await answers(2, [[cast.guestA, true]]);
    expect(await highlights(cast.tv)).toEqual([
      ["agreed", 2, 1, 0],
      ["divisive", 2, 1, 0],
    ]);
  });
});

describe("siding with the majority", () => {
  it("counts the revealed hot takes the guest answered that had a majority", async () => {
    await answers(0, [
      [cast.guestA, true],
      [cast.guestB, true],
      [carl, false],
    ]);
    // An even split has no majority, so it doesn't count.
    await answers(1, [
      [cast.guestA, true],
      [cast.guestB, false],
    ]);
    await answers(2, [
      [cast.guestA, true],
      [cast.guestB, false],
      [carl, false],
    ]);
    await reveal(0, 1, 2);
    expect(await majority(cast.guestA)).toEqual([[1, 2]]);
    expect(await majority(cast.guestB)).toEqual([[2, 2]]);
    expect(await majority(carl)).toEqual([[1, 2]]);
  });

  it("is 0 of 0 for a guest who answered nothing", async () => {
    await answers(0, [[cast.guestA, true]]);
    await reveal(0);
    expect(await majority(dora)).toEqual([[0, 0]]);
  });

  it("only counts revealed hot takes", async () => {
    await answers(0, [[cast.guestA, true]]);
    await answers(1, [[cast.guestA, true]]);
    await reveal(0);
    expect(await majority(cast.guestA)).toEqual([[1, 1]]);
  });

  it("is nothing for the host and the TV", async () => {
    await answers(0, [[cast.guestA, true]]);
    await reveal(0);
    expect(await majority(cast.host)).toEqual([]);
    expect(await majority(cast.tv)).toEqual([]);
  });
});

describe("the catalog", () => {
  it("makes the result functions security definer with an empty search path", () => {
    for (const signature of [
      "public.hot_take_result(uuid)",
      "public.hot_take_highlights(uuid)",
      "public.my_hot_take_majority(uuid)",
    ]) {
      expect(
        sql(
          `select prosecdef, proconfig from pg_proc where oid = '${signature}'::regprocedure`,
        ),
        signature,
      ).toEqual(['t|{"search_path=\\"\\""}']);
    }
  });
});
