// Shared costs spec (#175), ticket #177: set_bill_sent and my_bill. Who can
// see a bill and when (only a current guest, only after the host sent it,
// only their own lines), how shares are rounded and recalculated, and the
// live signal. The HTTP side of set_bill_sent is in set-bill-sent.db.test.ts.
// Writes are made with the service role through the RPCs, as host-actions
// does once its key check has passed.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  expireEvent,
  seedCast,
  seedMember,
  serviceClient,
  signedOutClient,
  type Cast,
  type User,
} from "./helpers";

const SWISH = "46701234567";

type PurchaseInput = { name: string; price: number; sharers: string[] };

async function updateCosts(cast: Cast, purchases: PurchaseInput[]) {
  const { data, error } = await serviceClient().rpc("update_costs", {
    target_event_id: cast.event.id,
    costs: { payeeName: "Sam", swishNumber: SWISH, purchases },
  });
  expect(error).toBeNull();
  expect(data).toBe("updated");
}

async function setBillSent(cast: Cast, sent: boolean): Promise<string> {
  const { data, error } = await serviceClient().rpc("set_bill_sent", {
    target_event_id: cast.event.id,
    sent,
  });
  expect(error).toBeNull();
  return data as string;
}

async function myBill(user: User, cast: Cast) {
  const { data, error } = await user.client.rpc("my_bill", {
    target_event_id: cast.event.id,
  });
  expect(error).toBeNull();
  return data;
}

async function costsVersion(cast: Cast): Promise<number> {
  const { data, error } = await serviceClient()
    .from("events")
    .select("costs_version")
    .eq("id", cast.event.id)
    .single();
  expect(error).toBeNull();
  return data?.costs_version ?? -1;
}

/** Anna and Bertil share drinks (450); Anna alone has cake (120). */
async function castWithBill(): Promise<Cast> {
  const cast = await seedCast();
  await updateCosts(cast, [
    { name: "Drinks", price: 450, sharers: [cast.guestA.id, cast.guestB.id] },
    { name: "Cake", price: 120, sharers: [cast.guestA.id] },
  ]);
  return cast;
}

describe("my_bill before the bill is sent", () => {
  it("answers null to every role", async () => {
    const cast = await castWithBill();

    for (const user of [
      cast.guestA,
      cast.guestB,
      cast.host,
      cast.tv,
      cast.nonMember,
    ]) {
      expect(await myBill(user, cast)).toBeNull();
    }
  });

  it("answers null again after the bill is hidden", async () => {
    const cast = await castWithBill();
    expect(await setBillSent(cast, true)).toBe("sent");
    expect(await myBill(cast.guestA, cast)).not.toBeNull();

    expect(await setBillSent(cast, false)).toBe("hidden");

    expect(await myBill(cast.guestA, cast)).toBeNull();
  });

  it("answers null when shared costs are switched off", async () => {
    const cast = await seedCast();
    expect(await myBill(cast.guestA, cast)).toBeNull();
  });
});

describe("my_bill after the bill is sent", () => {
  it("gives a guest only their own lines, with the Swish number", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    expect(await myBill(cast.guestA, cast)).toEqual({
      payeeName: "Sam",
      swishNumber: SWISH,
      total: 345,
      lines: [
        { name: "Drinks", share: 225 },
        { name: "Cake", share: 120 },
      ],
    });
    expect(await myBill(cast.guestB, cast)).toEqual({
      payeeName: "Sam",
      swishNumber: SWISH,
      total: 225,
      lines: [{ name: "Drinks", share: 225 }],
    });
  });

  it("leaves nothing about other guests in the answer", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    const text = JSON.stringify(await myBill(cast.guestB, cast));

    expect(text).not.toContain("Anna");
    expect(text).not.toContain(cast.guestA.id);
    expect(text).not.toContain("Cake");
  });

  it("answers null to the host, the TV, a stranger and a signed-out client", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    for (const user of [cast.host, cast.tv, cast.nonMember, cast.otherHost]) {
      expect(await myBill(user, cast)).toBeNull();
    }
    const { data } = await signedOutClient().rpc("my_bill", {
      target_event_id: cast.event.id,
    });
    expect(data).toBeNull();
  });

  it("answers null to a guest of another event", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    const { data } = await cast.guestA.client.rpc("my_bill", {
      target_event_id: cast.otherEvent.id,
    });
    expect(data).toBeNull();
  });

  it("answers null to a removed guest", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);
    const removed = await serviceClient().rpc("remove_guest", {
      target_event_id: cast.event.id,
      target_user_id: cast.guestB.id,
    });
    expect(removed.data).toBe("removed");

    expect(await myBill(cast.guestB, cast)).toBeNull();
  });

  it("answers null once the event has expired", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);
    await expireEvent(cast.event.id);

    expect(await myBill(cast.guestA, cast)).toBeNull();
  });

  it("gives a guest who shares nothing an empty bill of 0 kr", async () => {
    const cast = await castWithBill();
    const late = await anonymousUser();
    await seedMember(cast.event.id, late.id, "guest", "Cecilia");
    await setBillSent(cast, true);

    expect(await myBill(late, cast)).toEqual({
      payeeName: "Sam",
      swishNumber: SWISH,
      total: 0,
      lines: [],
    });
  });
});

describe("shares", () => {
  it("rounds up: 100 kr shared by 3 is 34 kr each", async () => {
    const cast = await seedCast();
    const cecilia = await anonymousUser();
    await seedMember(cast.event.id, cecilia.id, "guest", "Cecilia");
    await updateCosts(cast, [
      {
        name: "Pizza",
        price: 100,
        sharers: [cast.guestA.id, cast.guestB.id, cecilia.id],
      },
    ]);
    await setBillSent(cast, true);

    for (const user of [cast.guestA, cast.guestB, cecilia]) {
      expect(await myBill(user, cast)).toMatchObject({
        total: 34,
        lines: [{ name: "Pizza", share: 34 }],
      });
    }
  });

  it("changes the others' shares at once when a guest is removed", async () => {
    const cast = await seedCast();
    const cecilia = await anonymousUser();
    await seedMember(cast.event.id, cecilia.id, "guest", "Cecilia");
    await updateCosts(cast, [
      {
        name: "Pizza",
        price: 100,
        sharers: [cast.guestA.id, cast.guestB.id, cecilia.id],
      },
    ]);
    await setBillSent(cast, true);

    await serviceClient().rpc("remove_guest", {
      target_event_id: cast.event.id,
      target_user_id: cecilia.id,
    });

    expect(await myBill(cast.guestA, cast)).toMatchObject({ total: 50 });
    expect(await myBill(cast.guestB, cast)).toMatchObject({ total: 50 });
  });

  it("follows a purchase added after the bill was sent", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    await updateCosts(cast, [
      { name: "Drinks", price: 450, sharers: [cast.guestA.id, cast.guestB.id] },
      { name: "Pizza", price: 90, sharers: [cast.guestB.id] },
    ]);

    expect(await myBill(cast.guestB, cast)).toMatchObject({ total: 315 });
    expect(await myBill(cast.guestA, cast)).toMatchObject({ total: 225 });
  });
});

describe("set_bill_sent", () => {
  it("answers costs_off while shared costs are off", async () => {
    const cast = await seedCast();
    expect(await setBillSent(cast, true)).toBe("costs_off");
  });

  it("answers not_found for an expired event", async () => {
    const cast = await castWithBill();
    await expireEvent(cast.event.id);
    expect(await setBillSent(cast, true)).toBe("not_found");
  });

  it("keeps the first time the bill was sent", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);
    const first = await sentAt(cast);

    await setBillSent(cast, true);

    expect(await sentAt(cast)).toBe(first);
  });

  it("can't be called by a client", async () => {
    const cast = await castWithBill();
    for (const user of [cast.host, cast.guestA, cast.tv, cast.nonMember]) {
      const { error } = await user.client.rpc("set_bill_sent", {
        target_event_id: cast.event.id,
        sent: true,
      });
      expect(error).not.toBeNull();
    }
    expect(await myBill(cast.guestA, cast)).toBeNull();
  });

  it("lets a guest not read bill_sent_at directly", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    const { data } = await cast.guestA.client.from("cost_settings").select("*");
    expect(data).toEqual([]);
  });
});

async function sentAt(cast: Cast): Promise<string | null> {
  const { data } = await serviceClient()
    .from("cost_settings")
    .select("bill_sent_at")
    .eq("event_id", cast.event.id)
    .single();
  return data?.bill_sent_at ?? null;
}

describe("the live signal costs_version", () => {
  it("stays put while the host works on costs before sending", async () => {
    const cast = await castWithBill();
    expect(await costsVersion(cast)).toBe(0);
  });

  it("goes up when the bill is sent and hidden", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);
    expect(await costsVersion(cast)).toBe(1);
    await setBillSent(cast, false);
    expect(await costsVersion(cast)).toBe(2);
  });

  it("goes up when costs change while the bill is sent, also when switched off", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);
    const sent = await costsVersion(cast);

    await updateCosts(cast, [
      { name: "Drinks", price: 450, sharers: [cast.guestA.id] },
    ]);
    expect(await costsVersion(cast)).toBe(sent + 1);

    await serviceClient().rpc("update_costs", {
      target_event_id: cast.event.id,
      costs: null,
    });
    expect(await costsVersion(cast)).toBe(sent + 2);
    expect(await myBill(cast.guestA, cast)).toBeNull();
  });

  it("is readable by the guest and the TV, and carries no money", async () => {
    const cast = await castWithBill();
    await setBillSent(cast, true);

    for (const user of [cast.guestA, cast.tv]) {
      const { data } = await user.client
        .from("events")
        .select("costs_version")
        .eq("id", cast.event.id)
        .single();
      expect(data).toEqual({ costs_version: 1 });
    }
  });
});
