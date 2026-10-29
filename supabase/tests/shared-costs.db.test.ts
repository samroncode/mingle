// Shared costs spec (#175), ticket #176: the cost tables and update_costs.
// Who can read the tables (only the host, never a guest or the TV), that
// nobody writes them directly, and what update_costs does. The HTTP side
// (key, validation, error codes) is in update-costs.db.test.ts. Writes here
// are made with the service role through the RPC, as host-actions does once
// its key check has passed.
import { describe, expect, it } from "vitest";
import {
  expireEvent,
  randomCode,
  seedCast,
  seedMember,
  serviceClient,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

const SWISH = "46701234567";

type PurchaseInput = { name: string; price: number; sharers: string[] };

function costsOf(purchases: PurchaseInput[], swishNumber = SWISH) {
  return { payeeName: "Sam", swishNumber, purchases };
}

/** Calls update_costs the way host-actions does. */
async function updateCosts(
  eventId: string,
  costs: ReturnType<typeof costsOf> | null,
): Promise<string> {
  const { data, error } = await serviceClient().rpc("update_costs", {
    target_event_id: eventId,
    costs,
  });
  expect(error).toBeNull();
  return data as string;
}

/** An event with Anna and Bertil sharing drinks and Anna alone sharing cake. */
async function castWithCosts(): Promise<Cast> {
  const cast = await seedCast();
  const outcome = await updateCosts(
    cast.event.id,
    costsOf([
      {
        name: "Drinks",
        price: 450,
        sharers: [cast.guestA.id, cast.guestB.id],
      },
      { name: "Cake", price: 120, sharers: [cast.guestA.id] },
    ]),
  );
  expect(outcome).toBe("updated");
  return cast;
}

const tables = ["cost_settings", "cost_purchases", "cost_sharers"] as const;

async function readAll(user: User): Promise<number[]> {
  const counts: number[] = [];
  for (const table of tables) {
    const { data, error } = await user.client.from(table).select("*");
    expect(error).toBeNull();
    counts.push(data?.length ?? 0);
  }
  return counts;
}

describe("reading the cost tables", () => {
  it("lets the host read everything of their event", async () => {
    const cast = await castWithCosts();

    expect(await readAll(cast.host)).toEqual([1, 2, 3]);

    const { data } = await cast.host.client
      .from("cost_settings")
      .select("payee_name, swish_number, bill_sent_at");
    expect(data).toEqual([
      { payee_name: "Sam", swish_number: SWISH, bill_sent_at: null },
    ]);
  });

  it.each([
    ["a guest", (cast: Cast) => cast.guestA],
    ["another guest", (cast: Cast) => cast.guestB],
    ["the TV", (cast: Cast) => cast.tv],
    ["a non-member", (cast: Cast) => cast.nonMember],
    ["the host of another event", (cast: Cast) => cast.otherHost],
  ])("shows %s nothing", async (_, who) => {
    const cast = await castWithCosts();

    expect(await readAll(who(cast))).toEqual([0, 0, 0]);
  });

  it("gives a browser with no session no access at all", async () => {
    await castWithCosts();
    const client = signedOutClient();

    for (const table of tables) {
      const { data, error } = await client.from(table).select("*");
      expect(data ?? []).toEqual([]);
      expect(error).not.toBeNull();
    }
  });

  it("keeps the Swish number out of everything the TV and guests can read", async () => {
    const cast = await castWithCosts();

    for (const who of [cast.tv, cast.guestA]) {
      const events = await who.client.from("events").select("*");
      const members = await who.client.from("members").select("*");
      const text = JSON.stringify([events.data, members.data]);
      expect(text).not.toContain(SWISH);
      expect(text).not.toContain("Drinks");
    }
  });

  it("stops showing the host a table once they are removed from the event", async () => {
    const cast = await castWithCosts();
    sql(
      `delete from public.members where event_id = '${cast.event.id}' ` +
        `and user_id = '${cast.host.id}'`,
    );

    expect(await readAll(cast.host)).toEqual([0, 0, 0]);
  });
});

describe("writing the cost tables directly", () => {
  it("lets nobody insert, update or delete, not even the host", async () => {
    const cast = await castWithCosts();

    for (const who of [cast.host, cast.guestA, cast.tv, cast.nonMember]) {
      const insert = await who.client.from("cost_settings").insert({
        event_id: cast.otherEvent.id,
        payee_name: "Me",
        swish_number: SWISH,
      });
      expect(insert.error).not.toBeNull();

      const update = await who.client
        .from("cost_settings")
        .update({ swish_number: "46700000000", bill_sent_at: "2026-01-01" })
        .eq("event_id", cast.event.id);
      expect(update.error).not.toBeNull();

      const purchase = await who.client.from("cost_purchases").insert({
        event_id: cast.event.id,
        position: 9,
        name: "Free",
        price_kr: 1,
      });
      expect(purchase.error).not.toBeNull();

      const removal = await who.client
        .from("cost_purchases")
        .delete()
        .eq("event_id", cast.event.id);
      expect(removal.error).not.toBeNull();

      const sharer = await who.client.from("cost_sharers").insert({
        purchase_id: "00000000-0000-0000-0000-000000000000",
        event_id: cast.event.id,
        user_id: who.id,
      });
      expect(sharer.error).not.toBeNull();
    }

    expect(
      sql(
        `select swish_number || '|' || coalesce(bill_sent_at::text, '') ` +
          `from public.cost_settings where event_id = '${cast.event.id}'`,
      ),
    ).toEqual([`${SWISH}|`]);
    expect(
      sql(
        `select count(*) from public.cost_purchases ` +
          `where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["2"]);
  });

  it("does not let a client call update_costs", async () => {
    const cast = await seedCast();

    for (const who of [cast.host, cast.guestA, cast.tv]) {
      const { error } = await who.client.rpc("update_costs", {
        target_event_id: cast.event.id,
        costs: costsOf([]),
      });
      expect(error).not.toBeNull();
    }
    const { error } = await signedOutClient().rpc("update_costs", {
      target_event_id: cast.event.id,
      costs: costsOf([]),
    });
    expect(error).not.toBeNull();
    expect(
      sql(
        `select count(*) from public.cost_settings ` +
          `where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["0"]);
  });
});

describe("update_costs", () => {
  it("switches shared costs on with no purchases", async () => {
    const cast = await seedCast();

    expect(await updateCosts(cast.event.id, costsOf([]))).toBe("updated");

    expect(await readAll(cast.host)).toEqual([1, 0, 0]);
  });

  it("stores purchases in order with their sharers", async () => {
    const cast = await castWithCosts();

    const { data } = await cast.host.client
      .from("cost_purchases")
      .select("position, name, price_kr, cost_sharers(user_id)")
      .order("position");

    const stored = (data ?? []).map((purchase) => ({
      position: purchase.position,
      name: purchase.name,
      price: purchase.price_kr,
      sharers: purchase.cost_sharers.map((sharer) => sharer.user_id).sort(),
    }));
    expect(stored).toEqual([
      {
        position: 0,
        name: "Drinks",
        price: 450,
        sharers: [cast.guestA.id, cast.guestB.id].sort(),
      },
      { position: 1, name: "Cake", price: 120, sharers: [cast.guestA.id] },
    ]);
  });

  it("replaces the whole purchase list and keeps the time the bill was sent", async () => {
    const cast = await castWithCosts();
    sql(
      `update public.cost_settings set bill_sent_at = '2026-10-29T20:00:00Z' ` +
        `where event_id = '${cast.event.id}'`,
    );

    const outcome = await updateCosts(cast.event.id, {
      payeeName: "Sam R",
      swishNumber: "46729876543",
      purchases: [{ name: "Pizza", price: 300, sharers: [cast.guestB.id] }],
    });

    expect(outcome).toBe("updated");
    const settings = await cast.host.client
      .from("cost_settings")
      .select("payee_name, swish_number, bill_sent_at");
    expect(settings.data).toEqual([
      {
        payee_name: "Sam R",
        swish_number: "46729876543",
        bill_sent_at: "2026-10-29T20:00:00+00:00",
      },
    ]);
    const purchases = await cast.host.client
      .from("cost_purchases")
      .select("name");
    expect(purchases.data).toEqual([{ name: "Pizza" }]);
    expect(await readAll(cast.host)).toEqual([1, 1, 1]);
  });

  it("deletes everything when switched off, and again is fine", async () => {
    const cast = await castWithCosts();

    expect(await updateCosts(cast.event.id, null)).toBe("updated");
    expect(await readAll(cast.host)).toEqual([0, 0, 0]);
    expect(await updateCosts(cast.event.id, null)).toBe("updated");
  });

  it("leaves the costs of another event alone", async () => {
    const cast = await castWithCosts();
    await updateCosts(cast.otherEvent.id, costsOf([]));

    await updateCosts(cast.event.id, null);

    expect(
      sql(
        `select count(*) from public.cost_settings ` +
          `where event_id = '${cast.otherEvent.id}'`,
      ),
    ).toEqual(["1"]);
  });

  it("works for an ended event, so people can pay the next day", async () => {
    const cast = await seedCast({ status: "ended" });

    expect(await updateCosts(cast.event.id, costsOf([]))).toBe("updated");
  });

  it("answers not_found for an unknown or expired event", async () => {
    const cast = await seedCast();
    await expireEvent(cast.event.id);

    expect(await updateCosts(cast.event.id, costsOf([]))).toBe("not_found");
    const unknown = await serviceClient().rpc("update_costs", {
      target_event_id: "00000000-0000-0000-0000-000000000000",
      costs: costsOf([]),
    });
    expect(unknown.data).toBe("not_found");
  });

  describe("refuses a bad sharer and changes nothing", () => {
    async function expectRefusedAndUnchanged(
      cast: Cast,
      purchases: PurchaseInput[],
      outcome: string,
    ) {
      expect(await updateCosts(cast.event.id, costsOf(purchases))).toBe(
        outcome,
      );
      expect(await readAll(cast.host)).toEqual([1, 2, 3]);
    }

    it("a purchase nobody shares", async () => {
      const cast = await castWithCosts();
      await expectRefusedAndUnchanged(
        cast,
        [{ name: "Ghost", price: 10, sharers: [] }],
        "bad_sharer",
      );
    });

    it("the host, the TV, a non-member and a guest of another event", async () => {
      const cast = await castWithCosts();
      const stranger = await seedCastGuest(cast.otherEvent.id);
      for (const id of [
        cast.host.id,
        cast.tv.id,
        cast.nonMember.id,
        stranger,
      ]) {
        await expectRefusedAndUnchanged(
          cast,
          [{ name: "Bad", price: 10, sharers: [cast.guestA.id, id] }],
          "bad_sharer",
        );
      }
    });

    it("a removed guest", async () => {
      const cast = await castWithCosts();
      const removed = await serviceClient().rpc("remove_guest", {
        target_event_id: cast.event.id,
        target_user_id: cast.guestB.id,
      });
      expect(removed.data).toBe("removed");
      await expectRefusedAndUnchanged(
        cast,
        [{ name: "Late", price: 10, sharers: [cast.guestB.id] }],
        "bad_sharer",
      );
    });
  });

  describe("refuses values outside the limits and changes nothing", () => {
    it.each([
      ["a price of 0", { name: "A", price: 0 }],
      ["a price over 100000", { name: "A", price: 100_001 }],
      ["an empty name", { name: "  ", price: 10 }],
      ["a name over 40 characters", { name: "x".repeat(41), price: 10 }],
    ])("%s", async (_, fields) => {
      const cast = await castWithCosts();

      const outcome = await updateCosts(
        cast.event.id,
        costsOf([
          { name: "Fine", price: 5, sharers: [cast.guestA.id] },
          { ...fields, sharers: [cast.guestA.id] },
        ]),
      );

      expect(outcome).toBe("invalid");
      expect(await readAll(cast.host)).toEqual([1, 2, 3]);
    });

    it.each([
      ["a number that isn't a Swedish mobile number", "46801234567"],
      ["a number with a leading zero", "0701234567"],
      ["a number that is too short", "4670123456"],
    ])("%s", async (_, number) => {
      const cast = await castWithCosts();

      const outcome = await updateCosts(cast.event.id, costsOf([], number));

      expect(outcome).toBe("invalid");
      expect(await readAll(cast.host)).toEqual([1, 2, 3]);
    });

    it("more than 50 purchases", async () => {
      const cast = await castWithCosts();
      const many = Array.from({ length: 51 }, (_, i) => ({
        name: `P${i}`,
        price: 1,
        sharers: [cast.guestA.id],
      }));

      expect(await updateCosts(cast.event.id, costsOf(many))).toBe("invalid");
      expect(await readAll(cast.host)).toEqual([1, 2, 3]);
    });

    it("a payee name that is empty", async () => {
      const cast = await castWithCosts();

      const outcome = await updateCosts(cast.event.id, {
        ...costsOf([]),
        payeeName: " ",
      });

      expect(outcome).toBe("invalid");
      expect(await readAll(cast.host)).toEqual([1, 2, 3]);
    });
  });
});

/** Adds a guest to an event, as a user the cast doesn't hold. */
async function seedCastGuest(eventId: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.createUser({
    email: `${randomCode().toLowerCase()}@example.test`,
  });
  if (error) throw error;
  await seedMember(eventId, data.user.id, "guest", "Outsider");
  return data.user.id;
}

describe("deleting an event", () => {
  it("deletes its costs with it", async () => {
    const cast = await castWithCosts();

    sql(`delete from public.events where id = '${cast.event.id}'`);

    for (const table of tables) {
      expect(
        sql(
          `select count(*) from public.${table} ` +
            `where event_id = '${cast.event.id}'`,
        ),
      ).toEqual(["0"]);
    }
  });

  it("deletes a guest's shares with the guest", async () => {
    const cast = await castWithCosts();

    sql(
      `delete from public.members where event_id = '${cast.event.id}' ` +
        `and user_id = '${cast.guestB.id}'`,
    );

    expect(await readAll(cast.host)).toEqual([1, 2, 2]);
  });
});

// A policy or a grant removed from the migration must fail a test: the
// catalog says what the tests above prove.
describe("the cost tables in the catalog", () => {
  it("have RLS on and exactly one policy each, for select", () => {
    for (const table of tables) {
      expect(
        sql(
          `select c.relrowsecurity, ` +
            `(select string_agg(p.polcmd::text, ',') from pg_policy p ` +
            `where p.polrelid = c.oid) ` +
            `from pg_class c where c.oid = 'public.${table}'::regclass`,
        ),
      ).toEqual(["t|r"]);
    }
  });
});
