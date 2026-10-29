// #65: the winners. After a reveal every member reads the winner or winners of
// a category and their count; the host alone reads the count per guest; a guest
// reads the votes they got; the end list and the awards won follow. Nothing
// is readable before the reveal or by a non-member, ties share the award, and
// votes for someone who is no longer a guest with a name don't count.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  anonymousUsers,
  seedAwardCategory,
  seedCast,
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
/// Categories by position 0 to 3; 3 is a draft.
let ids: string[];
let otherCategoryId: string;

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["awards"] });
  [carl, dora] = await anonymousUsers(2);
  await seedMember(cast.event.id, carl.id, "guest", "Carl");
  await seedMember(cast.event.id, dora.id, "guest", "Dora");
  ids = [
    await seedAwardCategory(cast.event.id, 0),
    await seedAwardCategory(cast.event.id, 1),
    await seedAwardCategory(cast.event.id, 2),
    await seedAwardCategory(cast.event.id, 3, { status: "draft" }),
  ];
  otherCategoryId = await seedAwardCategory(cast.otherEvent.id, 0, {
    revealed: true,
  });
});

beforeEach(async () => {
  const service = serviceClient();
  await service.from("award_votes").delete().eq("event_id", cast.event.id);
  await service
    .from("award_categories")
    .update({ revealed_at: null })
    .eq("event_id", cast.event.id);
});

const id = (position: number) => ids[position] as string;

async function reveal(...positions: number[]) {
  for (const position of positions) {
    await serviceClient()
      .from("award_categories")
      .update({ revealed_at: new Date().toISOString() })
      .eq("id", id(position));
  }
}

/** Service-role vote rows as [voter, pick] pairs on a position. */
async function votes(position: number, pairs: Array<[User, User]>) {
  const { error } = await serviceClient()
    .from("award_votes")
    .insert(
      pairs.map(([voter, pick]) => ({
        category_id: id(position),
        event_id: cast.event.id,
        voter_id: voter.id,
        voted_for_id: pick.id,
      })),
    );
  expect(error).toBeNull();
}

type Row = { user_id: string; votes: number };
const byUser = (rows: Row[] | null) =>
  Object.fromEntries((rows ?? []).map((r) => [r.user_id, r.votes]));

async function winners(who: User, position: number) {
  const { data, error } = await who.client.rpc("award_winners", {
    target_category_id: id(position),
  });
  expect(error).toBeNull();
  return byUser(data);
}

async function tally(who: User, position: number) {
  const { data, error } = await who.client.rpc("award_tally", {
    target_category_id: id(position),
  });
  expect(error).toBeNull();
  return byUser(data);
}

async function myVotes(who: User, position: number) {
  const { data, error } = await who.client.rpc("my_award_votes", {
    target_category_id: id(position),
  });
  expect(error).toBeNull();
  return (data ?? []).map((r) => r.votes);
}

describe("the winner of a category", () => {
  it("is the guest with the most votes, with the count, for every member", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
      [dora, carl],
    ]);
    await reveal(0);
    for (const who of [cast.host, cast.guestA, cast.guestB, carl, cast.tv]) {
      expect(await winners(who, 0)).toEqual({ [cast.guestB.id]: 2 });
    }
  });

  it("is shared by everyone tied", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [cast.guestB, cast.guestA],
      [carl, cast.guestB],
      [dora, cast.guestA],
    ]);
    await reveal(0);
    expect(await winners(cast.tv, 0)).toEqual({
      [cast.guestA.id]: 2,
      [cast.guestB.id]: 2,
    });
  });

  it("is nobody when nobody voted", async () => {
    await reveal(0);
    expect(await winners(cast.guestA, 0)).toEqual({});
  });

  it("follows a guest who renamed, for votes given and received", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
    ]);
    await reveal(0);
    const rename = await serviceClient()
      .from("members")
      .update({ display_name: "Bertil B" })
      .eq("user_id", cast.guestB.id);
    expect(rename.error).toBeNull();
    expect(await winners(cast.tv, 0)).toEqual({ [cast.guestB.id]: 2 });
    expect(await tally(cast.host, 0)).toMatchObject({ [cast.guestB.id]: 2 });
  });

  it("counts a guest who joined late like any other", async () => {
    await votes(0, [
      [cast.guestA, carl],
      [cast.guestB, carl],
      [dora, carl],
    ]);
    await reveal(0);
    expect(await winners(cast.guestA, 0)).toEqual({ [carl.id]: 3 });
  });

  it("does not count votes for someone who is no longer a guest with a name", async () => {
    const [leaver, nameless] = await anonymousUsers(2);
    await seedMember(cast.event.id, leaver.id, "guest", "Lena");
    await seedMember(cast.event.id, nameless.id, "guest", "Nils");
    await votes(0, [
      [cast.guestA, leaver],
      [cast.guestB, leaver],
      [carl, nameless],
      [dora, cast.guestA],
    ]);
    await reveal(0);
    await serviceClient()
      .from("members")
      .update({ role: "host" })
      .eq("user_id", leaver.id);
    await serviceClient()
      .from("members")
      .update({ display_name: null })
      .eq("user_id", nameless.id);
    expect(await winners(cast.tv, 0)).toEqual({ [cast.guestA.id]: 1 });
    expect(await tally(cast.host, 0)).not.toHaveProperty(leaver.id);
    expect(await tally(cast.host, 0)).not.toHaveProperty(nameless.id);
  });
});

describe("before the reveal and for outsiders", () => {
  it("gives nothing before the reveal, to anyone", async () => {
    await votes(0, [[cast.guestA, cast.guestB]]);
    for (const who of [cast.host, cast.guestA, cast.guestB, cast.tv]) {
      expect(await winners(who, 0)).toEqual({});
    }
    expect(await tally(cast.host, 0)).toEqual({});
    expect(await myVotes(cast.guestB, 0)).toEqual([]);
    const results = await cast.host.client.rpc("award_results", {
      target_event_id: cast.event.id,
    });
    expect(results.data).toEqual([]);
  });

  it("gives nothing for a draft category", async () => {
    await reveal(3);
    expect(await winners(cast.host, 3)).toEqual({});
    expect(await tally(cast.host, 3)).toEqual({});
  });

  it("gives non-members, a member of another event and signed-out users nothing", async () => {
    await votes(0, [[cast.guestA, cast.guestB]]);
    await reveal(0);
    for (const who of [cast.nonMember, cast.otherHost]) {
      expect(await winners(who, 0)).toEqual({});
      expect(await tally(who, 0)).toEqual({});
      expect(await myVotes(who, 0)).toEqual([]);
      const results = await who.client.rpc("award_results", {
        target_event_id: cast.event.id,
      });
      expect(results.data).toEqual([]);
      const won = await who.client.rpc("awards_won", {
        target_event_id: cast.event.id,
      });
      expect(won.data).toEqual([]);
    }
  });

  it("is refused for signed-out users", async () => {
    const anon = signedOutClient();
    const result = await anon.rpc("award_winners", {
      target_category_id: id(0),
    });
    expect(result.error).not.toBeNull();
  });

  it("does not leak a category of another event to its own members", async () => {
    const { data } = await cast.otherHost.client.rpc("award_tally", {
      target_category_id: otherCategoryId,
    });
    expect(data).toEqual([]);
    expect(await winners(cast.guestA, 0)).toEqual({});
    const asGuest = await cast.guestA.client.rpc("award_winners", {
      target_category_id: otherCategoryId,
    });
    expect(asGuest.data).toEqual([]);
  });
});

describe("the count per guest", () => {
  it("is for the host only, with every guest including those with 0", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
      [dora, carl],
    ]);
    await reveal(0);
    expect(await tally(cast.host, 0)).toEqual({
      [cast.guestA.id]: 0,
      [cast.guestB.id]: 2,
      [carl.id]: 1,
      [dora.id]: 0,
    });
    for (const who of [cast.guestA, cast.guestB, cast.tv, cast.nonMember]) {
      expect(await tally(who, 0)).toEqual({});
    }
  });

  it("lists the best first", async () => {
    await votes(0, [
      [cast.guestA, carl],
      [cast.guestB, carl],
      [dora, cast.guestA],
    ]);
    await reveal(0);
    const { data } = await cast.host.client.rpc("award_tally", {
      target_category_id: id(0),
    });
    expect((data ?? []).map((r) => r.votes)).toEqual([2, 1, 0, 0]);
  });
});

describe("the votes a guest got", () => {
  it("is each guest's own count, and nothing for the host and the TV", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
      [dora, carl],
    ]);
    await reveal(0);
    expect(await myVotes(cast.guestB, 0)).toEqual([2]);
    expect(await myVotes(carl, 0)).toEqual([1]);
    expect(await myVotes(cast.guestA, 0)).toEqual([0]);
    expect(await myVotes(cast.host, 0)).toEqual([]);
    expect(await myVotes(cast.tv, 0)).toEqual([]);
  });
});

describe("the end", () => {
  it("lists every revealed category in order with its winners", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
    ]);
    await votes(1, [[cast.guestA, carl]]);
    await reveal(0, 2);
    const { data, error } = await cast.tv.client.rpc("award_results", {
      target_event_id: cast.event.id,
    });
    expect(error).toBeNull();
    expect(
      (data ?? []).map((r) => [r.category_position, r.user_id, r.votes]),
    ).toEqual([
      [0, cast.guestB.id, 2],
      // Revealed with no votes: one row without a winner.
      [2, null, null],
    ]);
  });

  it("counts awards won per guest, ties for everyone tied", async () => {
    await votes(0, [
      [cast.guestA, cast.guestB],
      [carl, cast.guestB],
    ]);
    await votes(1, [
      [cast.guestA, cast.guestB],
      [cast.guestB, cast.guestA],
    ]);
    await reveal(0, 1);
    const asHost = await cast.host.client.rpc("awards_won", {
      target_event_id: cast.event.id,
    });
    expect(asHost.error).toBeNull();
    expect(
      Object.fromEntries((asHost.data ?? []).map((r) => [r.user_id, r.awards])),
    ).toEqual({
      [cast.guestA.id]: 1,
      [cast.guestB.id]: 2,
      [carl.id]: 0,
      [dora.id]: 0,
    });
  });

  it("gives a guest only their own awards won, and the TV none", async () => {
    await votes(0, [[cast.guestA, cast.guestB]]);
    await reveal(0);
    const asGuest = await cast.guestB.client.rpc("awards_won", {
      target_event_id: cast.event.id,
    });
    expect(asGuest.data).toEqual([{ user_id: cast.guestB.id, awards: 1 }]);
    const asTv = await cast.tv.client.rpc("awards_won", {
      target_event_id: cast.event.id,
    });
    expect(asTv.data).toEqual([]);
  });

  it("leaves unrevealed categories out of the awards won", async () => {
    await votes(1, [[cast.guestA, cast.guestB]]);
    const asGuest = await cast.guestB.client.rpc("awards_won", {
      target_event_id: cast.event.id,
    });
    expect(asGuest.data).toEqual([{ user_id: cast.guestB.id, awards: 0 }]);
  });
});

describe("the catalog", () => {
  it("lets only signed-in users run the results functions", () => {
    for (const fn of [
      "award_winners(uuid)",
      "award_tally(uuid)",
      "my_award_votes(uuid)",
      "award_results(uuid)",
      "awards_won(uuid)",
    ]) {
      expect(
        sql(
          `select has_function_privilege('anon', 'public.${fn}', 'execute'), has_function_privilege('authenticated', 'public.${fn}', 'execute')`,
        ),
        fn,
      ).toEqual(["f|t"]);
    }
  });

  it("keeps the helpers away from clients", () => {
    for (const fn of ["award_counts(uuid)", "award_winners(uuid)"]) {
      expect(
        sql(
          `select has_function_privilege('anon', 'private.${fn}', 'execute') or has_function_privilege('authenticated', 'private.${fn}', 'execute')`,
        ),
        fn,
      ).toEqual(["f"]);
    }
  });

  it("sets an empty search path on the results functions", () => {
    expect(
      sql(
        "select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('award_winners', 'award_tally', 'my_award_votes', 'award_results', 'awards_won') and p.prosecdef and p.proconfig = array['search_path=\"\"']",
      ),
    ).toEqual(["5"]);
  });
});
