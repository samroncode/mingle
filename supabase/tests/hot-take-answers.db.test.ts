// #72: guests answer Agree or Disagree. A guest writes only their own answer,
// only while hot takes run on that hot take with the phase open; the answers
// are secret (only the guest who gave one reads an answer row, not the host
// and not the TV); the hot take counts new answers.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  anonymousUsers,
  seedCast,
  seedEvent,
  seedHotTake,
  seedMember,
  serviceClient,
  setEventFlow,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** Hot take ids by position 0 to 2 in the event; 2 is a draft. */
let ids: string[];
/** A hot take of the other event, at position 0. */
let otherTakeId: string;

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "hottakes"] });
  ids = [
    await seedHotTake(cast.event.id, 0),
    await seedHotTake(cast.event.id, 1),
    await seedHotTake(cast.event.id, 2, { status: "draft" }),
  ];
  otherTakeId = await seedHotTake(cast.otherEvent.id, 0);
  await serviceClient()
    .from("events")
    .update({ enabled_modules: ["hottakes"] })
    .eq("id", cast.otherEvent.id);
  await setEventFlow(cast.otherEvent.id, hotTakesOn(0, "open"));
});

type Flow = Parameters<typeof setEventFlow>[1];

const hotTakesOn = (
  step: number,
  phase: "idle" | "open" | "revealed",
): Flow => ({
  status: "live",
  current_module: "hottakes",
  current_step: step,
  phase,
});

beforeEach(async () => {
  const service = serviceClient();
  await service.from("hot_take_answers").delete().eq("event_id", cast.event.id);
  await service
    .from("hot_takes")
    .update({ revealed_at: null, answer_count: 0 })
    .eq("event_id", cast.event.id);
  await setEventFlow(cast.event.id, hotTakesOn(0, "open"));
});

/** Inserts an answer row; the fields default to Anna agreeing with the first. */
function answer(
  who: User,
  fields: Partial<{
    hot_take_id: string;
    event_id: string;
    guest_id: string;
    agree: boolean;
  }> = {},
) {
  return who.client.from("hot_take_answers").insert({
    hot_take_id: ids[0] as string,
    event_id: cast.event.id,
    guest_id: who.id,
    agree: true,
    ...fields,
  });
}

/** Changes the guest's answer on the first hot take. */
function changeAnswer(who: User, agree: boolean) {
  return who.client
    .from("hot_take_answers")
    .update({ agree })
    .eq("hot_take_id", ids[0] as string)
    .eq("guest_id", who.id)
    .select();
}

/** What the service role sees: every answer to the hot take as [guest, agree]. */
async function storedAnswers(takeId: string) {
  const { data, error } = await serviceClient()
    .from("hot_take_answers")
    .select("guest_id, agree")
    .eq("hot_take_id", takeId);
  expect(error).toBeNull();
  return (data ?? []).map((row) => [row.guest_id, row.agree]);
}

async function countOf(takeId: string): Promise<number | undefined> {
  const { data } = await cast.host.client
    .from("hot_takes")
    .select("answer_count")
    .eq("id", takeId)
    .single();
  return data?.answer_count;
}

describe("a guest answering", () => {
  it("inserts and changes their own answer while the hot take is open", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, true],
    ]);
    const change = await changeAnswer(cast.guestA, false);
    expect(change.error).toBeNull();
    expect(change.data).toHaveLength(1);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, false],
    ]);
  });

  it("answers only once per hot take", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    expect((await answer(cast.guestA)).error?.code).toBe("23505");
  });

  it("is refused while the hot take is not open yet or is revealed", async () => {
    for (const phase of ["idle", "revealed"] as const) {
      await setEventFlow(cast.event.id, hotTakesOn(0, phase));
      expect((await answer(cast.guestA)).error?.code, phase).toBe("42501");
    }
    expect(await storedAnswers(ids[0] as string)).toEqual([]);
  });

  it("is refused on a hot take that is not the current one", async () => {
    const result = await answer(cast.guestA, { hot_take_id: ids[1] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused on a draft hot take", async () => {
    await setEventFlow(cast.event.id, hotTakesOn(2, "open"));
    const result = await answer(cast.guestA, { hot_take_id: ids[2] as string });
    expect(result.error?.code).toBe("42501");
  });

  it("is refused while another activity runs", async () => {
    await setEventFlow(cast.event.id, {
      ...hotTakesOn(0, "open"),
      current_module: "quiz",
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

  it("is refused for a hot take of another event", async () => {
    const result = await answer(cast.guestA, { hot_take_id: otherTakeId });
    expect(result.error).not.toBeNull();
    const asOther = await answer(cast.guestA, {
      hot_take_id: otherTakeId,
      event_id: cast.otherEvent.id,
    });
    expect(asOther.error?.code).toBe("42501");
    expect(await storedAnswers(otherTakeId)).toEqual([]);
  });

  it("is refused for another guest's row", async () => {
    const result = await answer(cast.guestA, { guest_id: cast.guestB.id });
    expect(result.error?.code).toBe("42501");
    expect(await storedAnswers(ids[0] as string)).toEqual([]);
  });

  it("cannot change another guest's answer", async () => {
    expect((await answer(cast.guestB, { agree: true })).error).toBeNull();
    const result = await cast.guestA.client
      .from("hot_take_answers")
      .update({ agree: false })
      .eq("guest_id", cast.guestB.id)
      .select();
    expect(result.data ?? []).toEqual([]);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestB.id, true],
    ]);
  });

  it("cannot change their answer after the reveal", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    await setEventFlow(cast.event.id, hotTakesOn(0, "revealed"));
    const result = await changeAnswer(cast.guestA, false);
    expect(result.data ?? []).toEqual([]);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, true],
    ]);
  });

  it("cannot move their answer to another hot take, event or guest", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    const changes = [
      { hot_take_id: ids[1] as string },
      { event_id: cast.otherEvent.id },
      { guest_id: cast.guestB.id },
    ];
    for (const change of changes) {
      const result = await cast.guestA.client
        .from("hot_take_answers")
        .update(change)
        .eq("guest_id", cast.guestA.id);
      expect(result.error?.code, JSON.stringify(change)).toBe("42501");
    }
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, true],
    ]);
  });

  it("cannot delete an answer", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    const result = await cast.guestA.client
      .from("hot_take_answers")
      .delete()
      .eq("guest_id", cast.guestA.id);
    expect(result.error?.code).toBe("42501");
    expect(await storedAnswers(ids[0] as string)).toHaveLength(1);
  });

  it("keeps their answers when they rename", async () => {
    expect((await answer(cast.guestA)).error).toBeNull();
    await serviceClient()
      .from("members")
      .update({ display_name: "Anna Lisa" })
      .eq("event_id", cast.event.id)
      .eq("user_id", cast.guestA.id);
    expect(await storedAnswers(ids[0] as string)).toEqual([
      [cast.guestA.id, true],
    ]);
    expect((await changeAnswer(cast.guestA, false)).error).toBeNull();
  });

  it("lets a guest who joins late answer the open hot take", async () => {
    const [late] = await anonymousUsers(1);
    await seedMember(cast.event.id, late.id, "guest", "Sent");
    expect((await answer(late, { agree: false })).error).toBeNull();
    expect(await storedAnswers(ids[0] as string)).toEqual([[late.id, false]]);
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
  const result = await client.from("hot_take_answers").insert({
    hot_take_id: ids[0] as string,
    event_id: cast.event.id,
    guest_id: cast.guestA.id,
    agree: true,
  });
  expect(result.error).not.toBeNull();
  const read = await client.from("hot_take_answers").select();
  expect(read.data ?? []).toEqual([]);
});

describe("reading answers", () => {
  beforeEach(async () => {
    expect((await answer(cast.guestA, { agree: true })).error).toBeNull();
    expect((await answer(cast.guestB, { agree: false })).error).toBeNull();
  });

  async function readBy(who: User) {
    const { data, error } = await who.client
      .from("hot_take_answers")
      .select("guest_id, agree");
    expect(error).toBeNull();
    return (data ?? []).map((row) => [row.guest_id, row.agree]);
  }

  it("lets a guest read only their own answer, also after the reveal", async () => {
    expect(await readBy(cast.guestA)).toEqual([[cast.guestA.id, true]]);
    expect(await readBy(cast.guestB)).toEqual([[cast.guestB.id, false]]);
    await setEventFlow(cast.event.id, hotTakesOn(0, "revealed"));
    expect(await readBy(cast.guestA)).toEqual([[cast.guestA.id, true]]);
  });

  it.each(["host", "tv", "nonMember", "otherHost"] as const)(
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
    await changeAnswer(cast.guestA, false);
    expect(await countOf(ids[0] as string)).toBe(1);
    await answer(cast.guestB, { agree: false });
    expect(await countOf(ids[0] as string)).toBe(2);
  });

  it("counts a late joiner", async () => {
    await answer(cast.guestA);
    const [late] = await anonymousUsers(1);
    await seedMember(cast.event.id, late.id, "guest", "Sent");
    await answer(late);
    expect(await countOf(ids[0] as string)).toBe(2);
  });

  it("is read by every member through the hot take, with no answers", async () => {
    await answer(cast.guestA);
    for (const who of [cast.guestB, cast.tv, cast.host]) {
      const { data } = await who.client
        .from("hot_takes")
        .select("answer_count")
        .eq("id", ids[0] as string)
        .single();
      expect(data?.answer_count).toBe(1);
    }
  });
});

describe("the catalog", () => {
  it("has row level security on, no delete grant and fixed columns", () => {
    expect(
      sql(
        "select relrowsecurity from pg_class where oid = 'public.hot_take_answers'::regclass",
      ),
    ).toEqual(["t"]);
    expect(
      sql(
        "select privilege_type from information_schema.role_table_grants where table_name = 'hot_take_answers' and grantee in ('anon', 'authenticated') order by 1",
      ),
    ).toEqual(["SELECT"]);
    expect(
      sql(
        "select column_name from information_schema.role_column_grants where table_name = 'hot_take_answers' and grantee = 'authenticated' and privilege_type = 'UPDATE'",
      ),
    ).toEqual(["agree"]);
  });

  it("is deleted with the event", async () => {
    const event = await seedEvent({ enabled_modules: ["hottakes"] });
    const [a] = await anonymousUsers(1);
    await seedMember(event.id, a.id, "guest", "Ann");
    const take = await seedHotTake(event.id, 0);
    const service = serviceClient();
    const inserted = await service.from("hot_take_answers").insert({
      hot_take_id: take,
      event_id: event.id,
      guest_id: a.id,
      agree: true,
    });
    expect(inserted.error).toBeNull();
    await service.from("events").delete().eq("id", event.id);
    expect(await storedAnswers(take)).toEqual([]);
  });
});
