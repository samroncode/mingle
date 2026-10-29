// Shared costs spec (#175), ticket #176: host-actions `update_costs`, the
// host saving the shared costs. Called over HTTP through `supabase functions
// serve`; what the tables hold and who can read them is in
// shared-costs.db.test.ts.
import { describe, expect, it } from "vitest";
import { anonymousUser, anonymousUsers, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User; eventId: string };
type Cast = Host & { anna: User; bertil: User; tv: User };

/** An event made through host-actions with two guests and a TV. */
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
  const [anna, bertil, tv] = await anonymousUsers(3);
  await anna.client.rpc("join_event", {
    code: link.code,
    display_name: "Anna",
  });
  await bertil.client.rpc("join_event", {
    code: link.code,
    display_name: "Bertil",
  });
  await tv.client.rpc("join_tv", { code: link.code });
  return { ...link, user, eventId, anna, bertil, tv };
}

function costsFor(cast: Cast, overrides: Record<string, unknown> = {}) {
  return {
    payeeName: "Sam",
    swishNumber: "070-123 45 67",
    purchases: [
      { name: "Drinks", price: 450, sharers: [cast.anna.id, cast.bertil.id] },
    ],
    ...overrides,
  };
}

function update(
  cast: Cast,
  costs: unknown,
  link: HostLink = cast,
  user: User = cast.user,
) {
  return callHostActions(
    { action: "update_costs", code: link.code, key: link.key, costs },
    { user },
  );
}

/** What the tables hold for the event, as "settings|purchases|sharers". */
function stored(cast: Cast): string {
  const count = (table: string) =>
    sql(
      `select count(*) from public.${table} where event_id = '${cast.eventId}'`,
    )[0];
  return `${count("cost_settings")}|${count("cost_purchases")}|${count("cost_sharers")}`;
}

describe("update_costs with the right key", () => {
  it("saves the costs, stores the number normalised and answers {}", async () => {
    const cast = await createCast();

    const response = await update(cast, costsFor(cast));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(stored(cast)).toBe("1|1|2");
    expect(
      sql(
        `select payee_name || '|' || swish_number from public.cost_settings where event_id = '${cast.eventId}'`,
      ),
    ).toEqual(["Sam|46701234567"]);
  });

  it("switches shared costs off with null and deletes the data", async () => {
    const cast = await createCast();
    expect((await update(cast, costsFor(cast))).status).toBe(200);

    const response = await update(cast, null);

    expect(response.status).toBe(200);
    expect(stored(cast)).toBe("0|0|0");
  });

  it("still saves after the evening has ended", async () => {
    const cast = await createCast();
    expect((await setFlow(cast, { type: "end_event" })).status).toBe(200);

    const response = await update(cast, costsFor(cast));

    expect(response.status).toBe(200);
    expect(stored(cast)).toBe("1|1|2");
  });

  it("is not readable by a guest or the TV afterwards", async () => {
    const cast = await createCast();
    expect((await update(cast, costsFor(cast))).status).toBe(200);

    for (const who of [cast.anna, cast.tv]) {
      const { data } = await who.client.from("cost_settings").select("*");
      expect(data).toEqual([]);
    }
  });
});

describe("update_costs validation", () => {
  it.each([
    ["a bad Swish number", { swishNumber: "12345" }],
    ["a landline number", { swishNumber: "08-123 45 67" }],
    ["an empty payee name", { payeeName: "  " }],
    ["a missing payee name", { payeeName: undefined }],
  ])("answers invalid_request for %s", async (_, overrides) => {
    const cast = await createCast();

    const response = await update(cast, costsFor(cast, overrides));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(stored(cast)).toBe("0|0|0");
  });

  it.each([
    ["a price of 0", { name: "A", price: 0 }],
    ["a price over 100000", { name: "A", price: 100_001 }],
    ["a price with öre", { name: "A", price: 9.5 }],
    ["an empty name", { name: " ", price: 10 }],
  ])("answers invalid_request for a purchase with %s", async (_, fields) => {
    const cast = await createCast();

    const response = await update(
      cast,
      costsFor(cast, {
        purchases: [{ ...fields, sharers: [cast.anna.id] }],
      }),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(stored(cast)).toBe("0|0|0");
  });

  it("answers invalid_request for a purchase nobody shares", async () => {
    const cast = await createCast();

    const response = await update(
      cast,
      costsFor(cast, { purchases: [{ name: "A", price: 10, sharers: [] }] }),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(stored(cast)).toBe("0|0|0");
  });

  it("answers invalid_request for costs with extra fields", async () => {
    const cast = await createCast();

    const response = await update(cast, costsFor(cast, { billSentAt: "now" }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });

  it("answers invalid_sharer for the host, the TV, an unknown user and a guest of another event", async () => {
    const [cast, other] = await Promise.all([createCast(), createCast()]);
    const targets = [
      cast.user.id,
      cast.tv.id,
      "00000000-0000-0000-0000-000000000000",
      other.anna.id,
    ];

    for (const userId of targets) {
      const response = await update(
        cast,
        costsFor(cast, {
          purchases: [
            { name: "A", price: 10, sharers: [cast.anna.id, userId] },
          ],
        }),
      );
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "invalid_sharer" });
    }
    expect(stored(cast)).toBe("0|0|0");
  });

  it("answers invalid_sharer for a removed guest", async () => {
    const cast = await createCast();
    const removed = await callHostActions(
      {
        action: "remove_guest",
        code: cast.code,
        key: cast.key,
        userId: cast.bertil.id,
      },
      { user: cast.user },
    );
    expect(removed.status).toBe(200);

    const response = await update(cast, costsFor(cast));

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_sharer" });
    expect(stored(cast)).toBe("0|0|0");
  });
});

describe("update_costs without the right key", () => {
  async function expectRefused(cast: Cast, link: HostLink, user?: User) {
    const response = await update(cast, costsFor(cast), link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(stored(cast)).toBe("0|0|0");
  }

  it("refuses a wrong key", async () => {
    const cast = await createCast();
    await expectRefused(cast, { code: cast.code, key: otherKey(cast.key) });
  });

  it("refuses the key of another event", async () => {
    const [cast, other] = await Promise.all([createCast(), createCast()]);
    await expectRefused(cast, { code: cast.code, key: other.key });
  });

  it("refuses an unknown code", async () => {
    const cast = await createCast();
    await expectRefused(cast, { code: unusedCode(), key: cast.key });
  });

  it("answers a wrong key and an unknown code the same", async () => {
    const cast = await createCast();
    const wrongKey = await update(cast, costsFor(cast), {
      code: cast.code,
      key: otherKey(cast.key),
    });
    const unknown = await update(cast, costsFor(cast), {
      code: unusedCode(),
      key: cast.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses switching off with a wrong key, and keeps the data", async () => {
    const cast = await createCast();
    expect((await update(cast, costsFor(cast))).status).toBe(200);

    const response = await update(cast, null, {
      code: cast.code,
      key: otherKey(cast.key),
    });

    expect(response.status).toBe(403);
    expect(stored(cast)).toBe("1|1|2");
  });

  it("refuses an expired event", async () => {
    const cast = await createCast();
    sql(
      `update public.events set expires_at = now() - interval '1 second' where id = '${cast.eventId}'`,
    );

    const response = await update(cast, costsFor(cast));

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("rate limit on update_costs", () => {
  const limit = 20;

  it(`allows ${limit} calls per user and event, then refuses`, async () => {
    const cast = await createCast();
    for (let i = 0; i < limit; i++) {
      expect((await update(cast, null)).status).toBe(200);
    }

    const response = await update(cast, costsFor(cast));

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(stored(cast)).toBe("0|0|0");
  });
});
