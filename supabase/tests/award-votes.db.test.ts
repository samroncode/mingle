// #64: guests vote. A guest writes only their own vote, only while awards run
// on that category with the phase open, and only for another guest with a
// display name; the votes are secret (only the voter reads a vote row); the
// category counts new votes; the host learns who has voted, never for whom.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  anonymousUsers,
  seedAwardCategory,
  seedCast,
  seedEvent,
  seedMember,
  serviceClient,
  setEventFlow,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** A guest of the other event. */
let otherGuest: User;
/** Category ids by position 0 to 2 in the event; 2 is a draft. */
let ids: string[];
/** A category of the other event, at position 0. */
let otherCategoryId: string;

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "awards"] });
  [otherGuest] = await anonymousUsers(1);
  await seedMember(cast.otherEvent.id, otherGuest.id, "guest", "Olle");
  ids = [
    await seedAwardCategory(cast.event.id, 0),
    await seedAwardCategory(cast.event.id, 1),
    await seedAwardCategory(cast.event.id, 2, { status: "draft" }),
  ];
  otherCategoryId = await seedAwardCategory(cast.otherEvent.id, 0);
  await serviceClient()
    .from("events")
    .update({ enabled_modules: ["awards"] })
    .eq("id", cast.otherEvent.id);
  await setEventFlow(cast.otherEvent.id, awardsOn(0, "open"));
});

type Flow = Parameters<typeof setEventFlow>[1];

const awardsOn = (step: number, phase: "idle" | "open" | "revealed"): Flow => ({
  status: "live",
  current_module: "awards",
  current_step: step,
  phase,
});

beforeEach(async () => {
  const service = serviceClient();
  await service.from("award_votes").delete().eq("event_id", cast.event.id);
  await service
    .from("award_categories")
    .update({ revealed_at: null, vote_count: 0 })
    .eq("event_id", cast.event.id);
  await setEventFlow(cast.event.id, awardsOn(0, "open"));
});

/** Inserts a vote row; the fields default to Anna voting for Bertil. */
function vote(
  who: User,
  fields: Partial<{
    category_id: string;
    event_id: string;
    voter_id: string;
    voted_for_id: string;
  }> = {},
) {
  return who.client.from("award_votes").insert({
    category_id: ids[0] as string,
    event_id: cast.event.id,
    voter_id: who.id,
    voted_for_id: cast.guestB.id,
    ...fields,
  });
}

/** Changes the voter's pick on the first category. */
function changeVote(who: User, votedFor: string) {
  return who.client
    .from("award_votes")
    .update({ voted_for_id: votedFor })
    .eq("category_id", ids[0] as string)
    .eq("voter_id", who.id)
    .select();
}

/** What the service role sees: every vote on the category as [voter, pick]. */
async function storedVotes(categoryId: string) {
  const { data, error } = await serviceClient()
    .from("award_votes")
    .select("voter_id, voted_for_id")
    .eq("category_id", categoryId);
  expect(error).toBeNull();
  return (data ?? []).map((row) => [row.voter_id, row.voted_for_id]);
}

async function countOf(categoryId: string): Promise<number | undefined> {
  const { data } = await cast.host.client
    .from("award_categories")
    .select("vote_count")
    .eq("id", categoryId)
    .single();
  return data?.vote_count;
}

describe("a guest voting", () => {
  it("inserts and changes their own vote while the category is open", async () => {
    const first = await vote(cast.guestA);
    expect(first.error).toBeNull();
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);

    const change = await changeVote(cast.guestA, cast.guestA.id);
    // Voting for yourself is not a change that is allowed.
    expect(change.error).not.toBeNull();
    const other = await seedGuest("Carl");
    const ok = await changeVote(cast.guestA, other.id);
    expect(ok.error).toBeNull();
    expect(ok.data).toHaveLength(1);
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestA.id, other.id],
    ]);
  });

  it("votes only once per category", async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    const again = await vote(cast.guestA);
    expect(again.error?.code).toBe("23505");
  });

  it("is refused while the category is not open yet or is revealed", async () => {
    for (const phase of ["idle", "revealed"] as const) {
      await setEventFlow(cast.event.id, awardsOn(0, phase));
      const result = await vote(cast.guestA);
      expect(result.error?.code, phase).toBe("42501");
    }
    expect(await storedVotes(ids[0] as string)).toEqual([]);
  });

  it("is refused on a category that is not the current one", async () => {
    const result = await vote(cast.guestA, { category_id: ids[1] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused on a draft category", async () => {
    await setEventFlow(cast.event.id, awardsOn(2, "open"));
    const result = await vote(cast.guestA, { category_id: ids[2] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused while another activity runs", async () => {
    await setEventFlow(cast.event.id, {
      ...awardsOn(0, "open"),
      current_module: "quiz",
    });
    expect((await vote(cast.guestA)).error?.code).toBe("42501");
  });

  it("is refused when the event is not live", async () => {
    await setEventFlow(cast.event.id, {
      status: "lobby",
      current_module: null,
      current_step: 0,
      phase: "idle",
    });
    expect((await vote(cast.guestA)).error?.code).toBe("42501");
  });

  it("is refused for a category of another event", async () => {
    const result = await vote(cast.guestA, { category_id: otherCategoryId });
    expect(result.error).not.toBeNull();
    const asOther = await vote(cast.guestA, {
      category_id: otherCategoryId,
      event_id: cast.otherEvent.id,
    });
    expect(asOther.error?.code).toBe("42501");
    expect(await storedVotes(otherCategoryId)).toEqual([]);
  });

  it("is refused for another guest's row", async () => {
    const result = await vote(cast.guestA, { voter_id: cast.guestB.id });
    expect(result.error?.code).toBe("42501");
    expect(await storedVotes(ids[0] as string)).toEqual([]);
  });

  it("cannot vote for themselves", async () => {
    const result = await vote(cast.guestA, { voted_for_id: cast.guestA.id });
    expect(result.error).not.toBeNull();
    expect(await storedVotes(ids[0] as string)).toEqual([]);
  });

  it.each(["host", "tv", "otherGuest"] as const)(
    "cannot vote for the %s",
    async (who) => {
      const target = { host: cast.host, tv: cast.tv, otherGuest }[who];
      const result = await vote(cast.guestA, { voted_for_id: target.id });
      expect(result.error).not.toBeNull();
      expect(await storedVotes(ids[0] as string)).toEqual([]);
    },
  );

  it("cannot vote for a user who is in no event", async () => {
    const [stranger] = await anonymousUsers(1);
    const result = await vote(cast.guestA, { voted_for_id: stranger.id });
    expect(result.error).not.toBeNull();
  });

  it("cannot change a vote to someone they could not vote for", async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    for (const target of [cast.host, cast.tv, otherGuest]) {
      const result = await changeVote(cast.guestA, target.id);
      expect(result.error?.code).toBe("42501");
    }
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);
  });

  it("cannot change another guest's vote", async () => {
    expect(
      (await vote(cast.guestB, { voted_for_id: cast.guestA.id })).error,
    ).toBeNull();
    const result = await cast.guestA.client
      .from("award_votes")
      .update({ voted_for_id: cast.guestB.id })
      .eq("voter_id", cast.guestB.id)
      .select();
    expect(result.data ?? []).toEqual([]);
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestB.id, cast.guestA.id],
    ]);
  });

  it("cannot change their vote after the reveal", async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    const other = await seedGuest("Dora");
    await setEventFlow(cast.event.id, awardsOn(0, "revealed"));
    const result = await changeVote(cast.guestA, other.id);
    expect(result.data ?? []).toEqual([]);
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);
  });

  it("cannot move their vote to another category, event or voter", async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    const changes = [
      { category_id: ids[1] as string },
      { event_id: cast.otherEvent.id },
      { voter_id: cast.guestB.id },
    ];
    for (const change of changes) {
      const result = await cast.guestA.client
        .from("award_votes")
        .update(change)
        .eq("voter_id", cast.guestA.id);
      expect(result.error?.code, JSON.stringify(change)).toBe("42501");
    }
    expect(await storedVotes(ids[0] as string)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);
  });

  it("cannot delete a vote", async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    const result = await cast.guestA.client
      .from("award_votes")
      .delete()
      .eq("voter_id", cast.guestA.id);
    expect(result.error?.code).toBe("42501");
    expect(await storedVotes(ids[0] as string)).toHaveLength(1);
  });
});

describe.each(["tv", "host", "nonMember", "otherHost"] as const)(
  "the %s",
  (role) => {
    it("cannot vote", async () => {
      const result = await vote(cast[role]);
      expect(result.error?.code).toBe("42501");
      expect(await storedVotes(ids[0] as string)).toEqual([]);
    });
  },
);

it("a browser without a session cannot vote or read", async () => {
  const client = signedOutClient();
  const result = await client.from("award_votes").insert({
    category_id: ids[0] as string,
    event_id: cast.event.id,
    voter_id: cast.guestA.id,
    voted_for_id: cast.guestB.id,
  });
  expect(result.error).not.toBeNull();
  const read = await client.from("award_votes").select();
  expect(read.data ?? []).toEqual([]);
});

describe("reading votes", () => {
  beforeEach(async () => {
    expect((await vote(cast.guestA)).error).toBeNull();
    expect(
      (await vote(cast.guestB, { voted_for_id: cast.guestA.id })).error,
    ).toBeNull();
  });

  async function readBy(who: User) {
    const { data, error } = await who.client
      .from("award_votes")
      .select("voter_id, voted_for_id");
    expect(error).toBeNull();
    return (data ?? []).map((row) => [row.voter_id, row.voted_for_id]);
  }

  it("lets a guest read only their own vote, also after the reveal", async () => {
    expect(await readBy(cast.guestA)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);
    expect(await readBy(cast.guestB)).toEqual([
      [cast.guestB.id, cast.guestA.id],
    ]);
    await setEventFlow(cast.event.id, awardsOn(0, "revealed"));
    expect(await readBy(cast.guestA)).toEqual([
      [cast.guestA.id, cast.guestB.id],
    ]);
  });

  it.each(["host", "tv", "nonMember", "otherHost"] as const)(
    "lets the %s read none",
    async (role) => {
      expect(await readBy(cast[role])).toEqual([]);
    },
  );
});

describe("the vote count", () => {
  it("counts each guest's first vote and not a changed one", async () => {
    expect(await countOf(ids[0] as string)).toBe(0);
    await vote(cast.guestA);
    expect(await countOf(ids[0] as string)).toBe(1);
    const other = await seedGuest("Erik");
    await changeVote(cast.guestA, other.id);
    expect(await countOf(ids[0] as string)).toBe(1);
    await vote(cast.guestB, { voted_for_id: cast.guestA.id });
    expect(await countOf(ids[0] as string)).toBe(2);
  });

  it("is read by every member through the category, with no votes", async () => {
    await vote(cast.guestA);
    for (const who of [cast.guestB, cast.tv, cast.host]) {
      const { data } = await who.client
        .from("award_categories")
        .select("vote_count")
        .eq("id", ids[0] as string)
        .single();
      expect(data?.vote_count).toBe(1);
    }
  });
});

describe("award_voters", () => {
  async function votersFor(who: User, categoryId = ids[0] as string) {
    const { data, error } = await who.client.rpc("award_voters", {
      target_category_id: categoryId,
    });
    expect(error).toBeNull();
    return (data ?? []).map((row) => row.user_id).sort();
  }

  beforeEach(async () => {
    await vote(cast.guestA);
    await vote(cast.guestB, { voted_for_id: cast.guestA.id });
  });

  it("gives the host the ids of the guests who have voted, not their picks", async () => {
    const { data } = await cast.host.client.rpc("award_voters", {
      target_category_id: ids[0] as string,
    });
    expect(data?.every((row) => Object.keys(row).join() === "user_id")).toBe(
      true,
    );
    expect(await votersFor(cast.host)).toEqual(
      [cast.guestA.id, cast.guestB.id].sort(),
    );
  });

  it.each(["guestA", "guestB", "tv", "nonMember", "otherHost"] as const)(
    "gives the %s nothing",
    async (role) => {
      expect(await votersFor(cast[role])).toEqual([]);
    },
  );

  it("gives a browser without a session an error", async () => {
    const { error } = await signedOutClient().rpc("award_voters", {
      target_category_id: ids[0] as string,
    });
    expect(error).not.toBeNull();
  });

  it("gives nothing for a category that is not the current one", async () => {
    expect(await votersFor(cast.host, ids[1] as string)).toEqual([]);
    await setEventFlow(cast.event.id, awardsOn(1, "open"));
    expect(await votersFor(cast.host)).toEqual([]);
  });

  it("gives nothing for an unknown category or another event's", async () => {
    expect(await votersFor(cast.host, otherCategoryId)).toEqual([]);
    expect(
      await votersFor(cast.host, "00000000-0000-0000-0000-000000000000"),
    ).toEqual([]);
  });

  it("gives nothing while another activity runs", async () => {
    await setEventFlow(cast.event.id, {
      ...awardsOn(0, "open"),
      current_module: "quiz",
    });
    expect(await votersFor(cast.host)).toEqual([]);
  });
});

describe("the catalog", () => {
  it("has row level security on, no delete grant and fixed columns", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.award_votes'::regclass",
      ),
    ).toEqual(["t"]);
    expect(
      sql(
        "select privilege_type from information_schema.role_table_grants where table_name = 'award_votes' and grantee in ('anon', 'authenticated') order by 1",
      ),
    ).toEqual(["SELECT"]);
    expect(
      sql(
        "select column_name from information_schema.role_column_grants where table_name = 'award_votes' and grantee = 'authenticated' and privilege_type = 'UPDATE'",
      ),
    ).toEqual(["voted_for_id"]);
  });

  it("is deleted with the event", async () => {
    const event = await seedEvent({ enabled_modules: ["awards"] });
    const [a, b] = await anonymousUsers(2);
    await seedMember(event.id, a.id, "guest", "Ann");
    await seedMember(event.id, b.id, "guest", "Bob");
    const category = await seedAwardCategory(event.id, 0);
    const service = serviceClient();
    const inserted = await service.from("award_votes").insert({
      category_id: category,
      event_id: event.id,
      voter_id: a.id,
      voted_for_id: b.id,
    });
    expect(inserted.error).toBeNull();
    await service.from("events").delete().eq("id", event.id);
    expect(await storedVotes(category)).toEqual([]);
  });
});

/** Adds a guest with a display name to the event. */
async function seedGuest(name: string): Promise<User> {
  const [user] = await anonymousUsers(1);
  await seedMember(cast.event.id, user.id, "guest", name);
  return user;
}
