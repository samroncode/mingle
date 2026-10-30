// Shared costs spec (#175), ticket #179: host-actions `set_payment`, the host
// confirming a guest's payment, marking a guest paid, or undoing it. Called
// over HTTP through `supabase functions serve`; the database side (amounts,
// statuses, what a guest sees) is in i-paid.db.test.ts.
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

async function switchOnCostsAndSend(cast: Cast) {
  const costs = await callHostActions(
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
  expect(costs.status).toBe(200);
  const sent = await callHostActions(
    { action: "set_bill_sent", code: cast.code, key: cast.key, sent: true },
    { user: cast.user },
  );
  expect(sent.status).toBe(200);
}

function pay(
  cast: Cast,
  change: "confirm" | "undo",
  userId: string = cast.anna.id,
  link: HostLink = cast,
  user: User = cast.user,
) {
  return callHostActions(
    { action: "set_payment", code: link.code, key: link.key, userId, change },
    { user },
  );
}

async function billOf(cast: Cast, user: User) {
  const { data } = await user.client.rpc("my_bill", {
    target_event_id: cast.eventId,
  });
  return data as { status: string; owed: number } | null;
}

describe("set_payment with the right key", () => {
  it("confirms, then undoes, answering {}", async () => {
    const cast = await createCast();
    await switchOnCostsAndSend(cast);

    const confirmed = await pay(cast, "confirm");
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toEqual({});
    expect(await billOf(cast, cast.anna)).toMatchObject({
      status: "paid",
      owed: 0,
    });
    expect(await billOf(cast, cast.bertil)).toMatchObject({ status: "owes" });

    const undone = await pay(cast, "undo");
    expect(undone.status).toBe(200);
    expect(await billOf(cast, cast.anna)).toMatchObject({
      status: "owes",
      owed: 225,
    });
  });

  it("answers invalid_transition while shared costs are off", async () => {
    const cast = await createCast();

    const response = await pay(cast, "confirm");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
  });

  it("answers not_found for a user who isn't a guest", async () => {
    const cast = await createCast();
    await switchOnCostsAndSend(cast);

    for (const userId of [cast.user.id, crypto.randomUUID()]) {
      const response = await pay(cast, "confirm", userId);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
  });

  it("still works after the evening has ended", async () => {
    const cast = await createCast();
    await switchOnCostsAndSend(cast);
    expect((await setFlow(cast, { type: "end_event" })).status).toBe(200);

    expect((await pay(cast, "confirm")).status).toBe(200);
  });

  it("rejects an unknown change and a user id that isn't a uuid", async () => {
    const cast = await createCast();
    for (const extra of [
      { userId: cast.anna.id, change: "pay" },
      { userId: "anna", change: "confirm" },
      { userId: cast.anna.id, change: "confirm", amount: 1 },
    ]) {
      const response = await callHostActions(
        { action: "set_payment", code: cast.code, key: cast.key, ...extra },
        { user: cast.user },
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
  });
});

describe("set_payment without the right key", () => {
  it("answers a wrong key, an unknown code and another event's key alike", async () => {
    const cast = await createCast();
    const other = await createCast();
    await switchOnCostsAndSend(cast);

    const answers = [
      await pay(cast, "confirm", cast.anna.id, {
        code: cast.code,
        key: otherKey(cast.key),
      }),
      await pay(cast, "confirm", cast.anna.id, {
        code: unusedCode(),
        key: cast.key,
      }),
      await pay(cast, "confirm", cast.anna.id, {
        code: cast.code,
        key: other.key,
      }),
    ];

    for (const answer of answers) {
      expect(answer.status).toBe(answers[0]?.status);
      expect(answer.body).toEqual(answers[0]?.body);
    }
    expect(await billOf(cast, cast.anna)).toMatchObject({ status: "owes" });
  });
});
