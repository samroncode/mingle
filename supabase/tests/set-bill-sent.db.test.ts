// Shared costs spec (#175), ticket #177: host-actions `set_bill_sent`, the
// host sending or hiding the bill. Called over HTTP through `supabase
// functions serve`; what a guest then reads is in send-bill.db.test.ts.
import { describe, expect, it } from "vitest";
import { anonymousUser, anonymousUsers, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };
type Cast = Host & { anna: User; bertil: User };

async function createCast(): Promise<Cast> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: [],
      party: {},
    },
    { user },
  );
  expect(response.status).toBe(200);
  const link = response.body as HostLink;
  const [eventId = ""] = sql(
    `select id from public.events where code = '${link.code}'`,
  );
  const [anna, bertil] = await anonymousUsers(2);
  await anna.client.rpc("join_event", {
    code: link.code,
    display_name: "Anna",
  });
  await bertil.client.rpc("join_event", {
    code: link.code,
    display_name: "Bertil",
  });
  return { ...link, user, eventId, anna, bertil };
}

async function switchOnCosts(cast: Cast) {
  const response = await callHostActions(
    {
      action: "update_costs",
      code: cast.code,
      key: cast.key,
      costs: {
        payeeName: "Sam",
        swishNumber: "070-123 45 67",
        purchases: [
          {
            name: "Drinks",
            price: 450,
            sharers: [cast.anna.id, cast.bertil.id],
          },
        ],
      },
    },
    { user: cast.user },
  );
  expect(response.status).toBe(200);
}

function send(
  cast: Cast,
  sent: boolean,
  link: HostLink = cast,
  user: User = cast.user,
) {
  return callHostActions(
    { action: "set_bill_sent", code: link.code, key: link.key, sent },
    { user },
  );
}

async function billOf(cast: Cast, user: User) {
  const { data } = await user.client.rpc("my_bill", {
    target_event_id: cast.eventId,
  });
  return data;
}

describe("set_bill_sent with the right key", () => {
  it("sends the bill, then hides it, answering {}", async () => {
    const cast = await createCast();
    await switchOnCosts(cast);
    expect(await billOf(cast, cast.anna)).toBeNull();

    const sent = await send(cast, true);
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({});
    expect(await billOf(cast, cast.anna)).toMatchObject({ total: 225 });

    const hidden = await send(cast, false);
    expect(hidden.status).toBe(200);
    expect(await billOf(cast, cast.anna)).toBeNull();
  });

  it("answers invalid_transition while shared costs are off", async () => {
    const cast = await createCast();

    const response = await send(cast, true);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });

  it("still works after the evening has ended", async () => {
    const cast = await createCast();
    await switchOnCosts(cast);
    expect((await setFlow(cast, { type: "end_event" })).status).toBe(200);

    expect((await send(cast, true)).status).toBe(200);
  });

  it("rejects a body that isn't a boolean", async () => {
    const cast = await createCast();
    const response = await callHostActions(
      { action: "set_bill_sent", code: cast.code, key: cast.key, sent: "yes" },
      { user: cast.user },
    );
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});

describe("set_bill_sent without the right key", () => {
  it("answers a wrong key, an unknown code and another event's key alike", async () => {
    const cast = await createCast();
    const other = await createCast();
    await switchOnCosts(cast);

    const answers = [
      await send(cast, true, { code: cast.code, key: otherKey(cast.key) }),
      await send(cast, true, { code: unusedCode(), key: cast.key }),
      await send(cast, true, { code: cast.code, key: other.key }),
    ];

    for (const answer of answers) {
      expect(answer.status).toBe(answers[0]?.status);
      expect(answer.body).toEqual(answers[0]?.body);
    }
    expect(await billOf(cast, cast.anna)).toBeNull();
  });

  it("refuses a guest who knows the right key but isn't the host", async () => {
    const cast = await createCast();
    await switchOnCosts(cast);

    const response = await send(cast, true, cast, cast.anna);

    expect(response.status).not.toBe(200);
    expect(await billOf(cast, cast.anna)).toBeNull();
  });
});
