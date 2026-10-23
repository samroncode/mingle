// #62: award categories. Nobody but the host reads a category before it is
// shown, non-members read nothing, and no client writes the table.
import { beforeAll, describe, expect, it } from "vitest";
import { listAwardCategories } from "../../src/api/awards";
import {
  expireEvent,
  seedAwardCategory,
  seedCast,
  serviceClient,
  setEventFlow,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;
/** The category ids by position 0 to 3; 3 is a draft. */
let ids: string[];

beforeAll(async () => {
  cast = await seedCast({ enabled_modules: ["quiz", "awards"] });
  ids = [
    await seedAwardCategory(cast.event.id, 0),
    await seedAwardCategory(cast.event.id, 1),
    await seedAwardCategory(cast.event.id, 2),
    await seedAwardCategory(cast.event.id, 3, { status: "draft" }),
  ];
  await seedAwardCategory(cast.otherEvent.id, 0);
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

/** The positions of the event's categories the user can read. */
async function positionsOf(who: User): Promise<number[]> {
  const { data, error } = await who.client
    .from("award_categories")
    .select("position")
    .eq("event_id", cast.event.id)
    .order("position");
  expect(error).toBeNull();
  return (data ?? []).map((row) => row.position);
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
    .from("award_categories")
    .update({ revealed_at: null })
    .eq("event_id", cast.event.id);
  for (const position of revealed) {
    await service
      .from("award_categories")
      .update({ revealed_at: new Date().toISOString() })
      .eq("event_id", cast.event.id)
      .eq("position", position);
  }
}

const awardsOn = (step: number, phase: Flow["phase"]): Flow => ({
  status: "live",
  current_module: "awards",
  current_step: step,
  phase,
});

describe("the host", () => {
  it("reads every category of their event, drafts included", async () => {
    await setFlow({});
    expect(await positionsOf(cast.host)).toEqual([0, 1, 2, 3]);
  });

  it("reads the text, status, revealed time and vote count", async () => {
    const { data } = await cast.host.client
      .from("award_categories")
      .select("text, status, revealed_at, vote_count")
      .eq("id", ids[0] as string)
      .single();
    expect(data).toEqual({
      text: "Most likely to 1",
      status: "approved",
      revealed_at: null,
      vote_count: 0,
    });
  });

  it("does not read the categories of another event", async () => {
    const { data } = await cast.otherHost.client
      .from("award_categories")
      .select("event_id");
    expect(data).toEqual([{ event_id: cast.otherEvent.id }]);
  });
});

describe.each(viewerRoles)("the %s", (role) => {
  it("reads no category before awards show one", async () => {
    await setFlow({});
    expect(await positionsOf(user(role))).toEqual([]);
  });

  it("reads no category while another activity runs on that step", async () => {
    await setFlow({ ...awardsOn(0, "open"), current_module: "quiz" });
    expect(await positionsOf(user(role))).toEqual([]);
  });

  it("reads a category while awards show it, open or revealed", async () => {
    await setFlow(awardsOn(1, "open"));
    expect(await positionsOf(user(role))).toEqual([1]);
    await setFlow(awardsOn(1, "revealed"));
    expect(await positionsOf(user(role))).toEqual([1]);
  });

  it("reads no category of an idle phase", async () => {
    await setFlow(awardsOn(2, "idle"));
    expect(await positionsOf(user(role))).toEqual([]);
  });

  it("keeps reading a revealed category after awards move on or stop", async () => {
    await setFlow(awardsOn(2, "open"), [0, 1]);
    expect(await positionsOf(user(role))).toEqual([0, 1, 2]);
    await setFlow({}, [0, 1]);
    expect(await positionsOf(user(role))).toEqual([0, 1]);
  });

  it("never reads a draft category, shown or revealed", async () => {
    await setFlow(awardsOn(3, "open"), [3]);
    expect(await positionsOf(user(role))).not.toContain(3);
  });
});

describe.each(outsiderRoles)("the %s", (role) => {
  it("reads no category of the event, even when shown or revealed", async () => {
    await setFlow(awardsOn(1, "revealed"), [0, 1]);
    expect(await positionsOf(user(role))).toEqual([]);
  });
});

it("a browser without a session reads nothing", async () => {
  await setFlow(awardsOn(1, "revealed"), [0, 1, 2]);
  const { data } = await signedOutClient().from("award_categories").select();
  expect(data ?? []).toEqual([]);
});

describe("writing", () => {
  /** The table as the service role sees it, to check nothing changed. */
  async function snapshot() {
    const { data } = await serviceClient()
      .from("award_categories")
      .select()
      .eq("event_id", cast.event.id)
      .order("position");
    return data;
  }

  it.each(allRoles)("the %s can't add a category", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("award_categories")
      .insert({ event_id: cast.event.id, position: 9, text: "Sneaky" });
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't change a category", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("award_categories")
      .update({
        text: "Changed",
        vote_count: 99,
        revealed_at: new Date().toISOString(),
      })
      .eq("event_id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });

  it.each(allRoles)("the %s can't delete a category", async (role) => {
    const before = await snapshot();
    const { error } = await user(role)
      .client.from("award_categories")
      .delete()
      .eq("event_id", cast.event.id);
    expect(error).not.toBeNull();
    expect(await snapshot()).toEqual(before);
  });
});

describe("the table's own checks", () => {
  const base = { position: 15, text: "Ok" };
  const bad: [string, Record<string, unknown>][] = [
    ["a negative position", { position: -1 }],
    ["a 21st category", { position: 20 }],
    ["empty text", { text: "" }],
    ["blank text", { text: "   " }],
    ["too long text", { text: "x".repeat(121) }],
    ["an unknown status", { status: "pending" }],
    ["a negative vote count", { vote_count: -1 }],
  ];

  it.each(bad)("refuse %s", async (_, change) => {
    const { error } = await serviceClient()
      .from("award_categories")
      .insert({ event_id: cast.otherEvent.id, ...base, ...change } as never);
    expect(error).not.toBeNull();
  });

  it("accept a text of exactly 120 characters", async () => {
    const { error } = await serviceClient()
      .from("award_categories")
      .insert({
        event_id: cast.otherEvent.id,
        position: 19,
        text: "x".repeat(120),
      });
    expect(error).toBeNull();
  });

  it("refuse a second category at the same position", async () => {
    const { error } = await serviceClient()
      .from("award_categories")
      .insert({ event_id: cast.event.id, ...base, position: 0 });
    expect(error?.code).toBe("23505");
  });
});

describe("listAwardCategories", () => {
  it("gives the host every category in order, and a guest only the shown one", async () => {
    await setFlow(awardsOn(1, "open"), [0]);
    const host = await listAwardCategories(cast.event.id, cast.host.client);
    expect(host).toEqual({
      ok: true,
      value: [0, 1, 2, 3].map((position) => ({
        id: ids[position],
        position,
        text: `Most likely to ${position + 1}`,
        voteCount: 0,
        revealed: position === 0,
      })),
    });

    const guest = await listAwardCategories(cast.event.id, cast.guestA.client);
    expect(
      guest.ok && guest.value.map((category) => category.position),
    ).toEqual([0, 1]);
  });
});

it("is in the realtime publication, so views follow a category", () => {
  expect(
    sql(
      "select 1 from pg_publication_tables where pubname = 'supabase_realtime' " +
        "and schemaname = 'public' and tablename = 'award_categories'",
    ),
  ).toEqual(["1"]);
});

describe("deleting", () => {
  it("removes categories with their event", async () => {
    const own = await seedCast({ enabled_modules: ["awards"] });
    const id = await seedAwardCategory(own.event.id, 0);
    await serviceClient().from("events").delete().eq("id", own.event.id);

    const { data } = await serviceClient()
      .from("award_categories")
      .select()
      .eq("id", id);
    expect(data).toEqual([]);
  });

  it("makes an expired event's categories unreachable, even for its host", async () => {
    const own = await seedCast({ enabled_modules: ["awards"] });
    await seedAwardCategory(own.event.id, 0, { revealed: true });
    await expireEvent(own.event.id);

    for (const who of [own.host, own.guestA]) {
      const { data } = await who.client.from("award_categories").select();
      expect(data).toEqual([]);
    }
  });
});
