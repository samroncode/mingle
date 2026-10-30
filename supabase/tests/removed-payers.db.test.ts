// Shared costs spec (#175), ticket #181: a removed guest drops out of every
// purchase and the others' shares are recalculated; the host is told when the
// removed guest had paid. Host writes use the service role, as host-actions
// does once its key check has passed.
import { describe, expect, it } from "vitest";
import {
  expireEvent,
  seedCast,
  serviceClient,
  signedOutClient,
  type Cast,
  type User,
} from "./helpers";

type Payer = { userId: string; name: string; paidKr: number | null };

async function setup(cast: Cast) {
  const costs = await serviceClient().rpc("update_costs", {
    target_event_id: cast.event.id,
    costs: {
      payeeName: "Sam",
      swishNumber: "46701234567",
      purchases: [
        {
          name: "Drinks",
          price: 450,
          sharers: [cast.guestA.id, cast.guestB.id],
        },
        { name: "Cake", price: 120, sharers: [cast.guestA.id] },
      ],
    },
  });
  expect(costs.error).toBeNull();
  const sent = await serviceClient().rpc("set_bill_sent", {
    target_event_id: cast.event.id,
    sent: true,
  });
  expect(sent.error).toBeNull();
}

async function remove(cast: Cast, user: User) {
  const { data, error } = await serviceClient().rpc("remove_guest", {
    target_event_id: cast.event.id,
    target_user_id: user.id,
  });
  expect(error).toBeNull();
  expect(data).toBe("removed");
}

async function payment(cast: Cast, user: User, change: "confirm" | "undo") {
  const { error } = await serviceClient().rpc("set_payment", {
    target_event_id: cast.event.id,
    target_user_id: user.id,
    change,
  });
  expect(error).toBeNull();
}

async function removedPayers(cast: Cast, user: User): Promise<Payer[]> {
  const { data, error } = await user.client.rpc("removed_payers", {
    target_event_id: cast.event.id,
  });
  expect(error).toBeNull();
  return data as Payer[];
}

async function totalOf(cast: Cast, user: User): Promise<number | undefined> {
  const { data } = await user.client.rpc("my_bill", {
    target_event_id: cast.event.id,
  });
  return (data as { total: number } | null)?.total;
}

describe("a removed guest and the shares", () => {
  it("recalculates the others' totals", async () => {
    const cast = await seedCast();
    await setup(cast);
    expect(await totalOf(cast, cast.guestB)).toBe(225);

    await remove(cast, cast.guestA);

    // Bertil now carries the whole of the drinks; the cake had only Anna.
    expect(await totalOf(cast, cast.guestB)).toBe(450);
    expect(await totalOf(cast, cast.guestA)).toBeUndefined();
  });
});

describe("removed_payers", () => {
  it("lists a removed guest the host had confirmed, with the amount", async () => {
    const cast = await seedCast();
    await setup(cast);
    await payment(cast, cast.guestA, "confirm");

    await remove(cast, cast.guestA);

    expect(await removedPayers(cast, cast.host)).toEqual([
      { userId: cast.guestA.id, name: "Anna", paidKr: 345 },
    ]);
  });

  it("lists a removed guest who only said they paid, without an amount", async () => {
    const cast = await seedCast();
    await setup(cast);
    const said = await cast.guestA.client.rpc("set_i_paid", {
      target_event_id: cast.event.id,
      paid: true,
    });
    expect(said.data).toBe("updated");

    await remove(cast, cast.guestA);

    expect(await removedPayers(cast, cast.host)).toEqual([
      { userId: cast.guestA.id, name: "Anna", paidKr: null },
    ]);
  });

  it("lists nobody who paid nothing, took it back or was undone", async () => {
    const cast = await seedCast();
    await setup(cast);
    await cast.guestA.client.rpc("set_i_paid", {
      target_event_id: cast.event.id,
      paid: true,
    });
    await cast.guestA.client.rpc("set_i_paid", {
      target_event_id: cast.event.id,
      paid: false,
    });
    await payment(cast, cast.guestB, "confirm");
    await payment(cast, cast.guestB, "undo");

    await remove(cast, cast.guestA);
    await remove(cast, cast.guestB);

    expect(await removedPayers(cast, cast.host)).toEqual([]);
  });

  it("leaves out a guest who is still in", async () => {
    const cast = await seedCast();
    await setup(cast);
    await payment(cast, cast.guestA, "confirm");

    expect(await removedPayers(cast, cast.host)).toEqual([]);
  });

  it("answers an empty list to everyone but the host of the event", async () => {
    const cast = await seedCast();
    await setup(cast);
    await payment(cast, cast.guestA, "confirm");
    await remove(cast, cast.guestA);

    for (const user of [cast.guestB, cast.tv, cast.nonMember, cast.otherHost]) {
      expect(await removedPayers(cast, user)).toEqual([]);
    }
  });

  it("can't be called by a signed-out client, and answers [] once expired", async () => {
    const cast = await seedCast();
    await setup(cast);
    await payment(cast, cast.guestA, "confirm");
    await remove(cast, cast.guestA);

    const signedOut = await signedOutClient().rpc("removed_payers", {
      target_event_id: cast.event.id,
    });
    expect(signedOut.error).not.toBeNull();

    await expireEvent(cast.event.id);
    expect(await removedPayers(cast, cast.host)).toEqual([]);
  });
});

describe("the TV and the summary", () => {
  it("never read any money", async () => {
    const cast = await seedCast();
    await setup(cast);

    for (const table of [
      "cost_settings",
      "cost_purchases",
      "cost_sharers",
      "cost_payments",
    ] as const) {
      const { data } = await cast.tv.client.from(table).select("*");
      expect(data).toEqual([]);
    }
    expect(await totalOf(cast, cast.tv)).toBeUndefined();
    const event = await cast.tv.client
      .from("events")
      .select("*")
      .eq("id", cast.event.id)
      .single();
    expect(JSON.stringify(event.data)).not.toMatch(/swish|46701234567/i);
  });
});
