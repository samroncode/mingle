// Shared costs spec (#175), ticket #179: a guest says "I've paid" and the
// host confirms. Who can change what (a guest only their own "I've paid", not
// before the bill is sent, not after the host confirmed), what a guest and the
// TV can see, and how a later purchase leaves only the difference to pay.
// Host writes use the service role through set_payment, as host-actions does
// once its key check has passed; the HTTP side is in set-payment.db.test.ts.
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

async function setBillSent(cast: Cast, sent: boolean) {
  const { error } = await serviceClient().rpc("set_bill_sent", {
    target_event_id: cast.event.id,
    sent,
  });
  expect(error).toBeNull();
}

async function setPayment(
  cast: Cast,
  user: User,
  change: string,
): Promise<string> {
  const { data, error } = await serviceClient().rpc("set_payment", {
    target_event_id: cast.event.id,
    target_user_id: user.id,
    change,
  });
  expect(error).toBeNull();
  return data as string;
}

async function iPaid(cast: Cast, user: User, paid: boolean): Promise<string> {
  const { data, error } = await user.client.rpc("set_i_paid", {
    target_event_id: cast.event.id,
    paid,
  });
  expect(error).toBeNull();
  return data as string;
}

async function myBill(cast: Cast, user: User) {
  const { data, error } = await user.client.rpc("my_bill", {
    target_event_id: cast.event.id,
  });
  expect(error).toBeNull();
  return data as {
    total: number;
    confirmed: number;
    owed: number;
    status: string;
  } | null;
}

/** Anna and Bertil share drinks (450); Anna alone has cake (120). Sent. */
async function castWithSentBill(): Promise<Cast> {
  const cast = await seedCast();
  await updateCosts(cast, [
    { name: "Drinks", price: 450, sharers: [cast.guestA.id, cast.guestB.id] },
    { name: "Cake", price: 120, sharers: [cast.guestA.id] },
  ]);
  await setBillSent(cast, true);
  return cast;
}

describe("set_i_paid", () => {
  it("marks the guest as Says paid, and takes it back", async () => {
    const cast = await castWithSentBill();

    expect(await iPaid(cast, cast.guestA, true)).toBe("updated");
    expect(await myBill(cast, cast.guestA)).toMatchObject({
      status: "says_paid",
      owed: 345,
    });

    expect(await iPaid(cast, cast.guestA, false)).toBe("updated");
    expect(await myBill(cast, cast.guestA)).toMatchObject({ status: "owes" });
  });

  it("changes only the caller's own status", async () => {
    const cast = await castWithSentBill();

    await iPaid(cast, cast.guestA, true);

    expect(await myBill(cast, cast.guestB)).toMatchObject({ status: "owes" });
  });

  it("answers not_sent before the bill is sent and after it is hidden", async () => {
    const cast = await castWithSentBill();
    await setBillSent(cast, false);
    expect(await iPaid(cast, cast.guestA, true)).toBe("not_sent");

    await setBillSent(cast, true);
    await iPaid(cast, cast.guestA, true);
    await setBillSent(cast, false);
    expect(await iPaid(cast, cast.guestA, false)).toBe("not_sent");
  });

  it("answers already_confirmed once the host has confirmed everything", async () => {
    const cast = await castWithSentBill();
    await iPaid(cast, cast.guestA, true);
    await setPayment(cast, cast.guestA, "confirm");

    expect(await iPaid(cast, cast.guestA, false)).toBe("already_confirmed");
    expect(await iPaid(cast, cast.guestA, true)).toBe("already_confirmed");
    expect(await myBill(cast, cast.guestA)).toMatchObject({ status: "paid" });
  });

  it("answers not_found to the host, the TV, a stranger and a removed guest", async () => {
    const cast = await castWithSentBill();
    await serviceClient().rpc("remove_guest", {
      target_event_id: cast.event.id,
      target_user_id: cast.guestB.id,
    });

    for (const user of [
      cast.host,
      cast.tv,
      cast.nonMember,
      cast.otherHost,
      cast.guestB,
    ]) {
      expect(await iPaid(cast, user, true)).toBe("not_found");
    }
    expect(await myBill(cast, cast.guestA)).toMatchObject({ status: "owes" });
  });

  it("answers not_found for a guest of another event", async () => {
    const cast = await castWithSentBill();
    const { data } = await cast.guestA.client.rpc("set_i_paid", {
      target_event_id: cast.otherEvent.id,
      paid: true,
    });
    expect(data).toBe("not_found");
  });

  it("answers not_found for a guest who owes nothing", async () => {
    const cast = await castWithSentBill();
    const late = await anonymousUser();
    await seedMember(cast.event.id, late.id, "guest", "Cecilia");

    expect(await iPaid(cast, late, true)).toBe("not_found");
  });

  it("still works once the event has ended", async () => {
    const cast = await castWithSentBill();
    const { error } = await serviceClient()
      .from("events")
      .update({ status: "ended" })
      .eq("id", cast.event.id);
    expect(error).toBeNull();

    expect(await iPaid(cast, cast.guestA, true)).toBe("updated");
  });

  it("answers not_found once the event has expired", async () => {
    const cast = await castWithSentBill();
    await expireEvent(cast.event.id);
    expect(await iPaid(cast, cast.guestA, true)).toBe("not_found");
  });

  it("can't be called by a signed-out client", async () => {
    const cast = await castWithSentBill();
    const { error } = await signedOutClient().rpc("set_i_paid", {
      target_event_id: cast.event.id,
      paid: true,
    });
    expect(error).not.toBeNull();
  });
});

describe("set_payment", () => {
  it("confirm stores the current total and the guest is Paid", async () => {
    const cast = await castWithSentBill();
    await iPaid(cast, cast.guestA, true);

    expect(await setPayment(cast, cast.guestA, "confirm")).toBe("confirmed");

    expect(await myBill(cast, cast.guestA)).toEqual({
      payeeName: "Sam",
      swishNumber: SWISH,
      total: 345,
      confirmed: 345,
      owed: 0,
      status: "paid",
      lines: [
        { name: "Drinks", share: 225 },
        { name: "Cake", share: 120 },
      ],
    });
  });

  it('marks a guest paid directly, without an "I\'ve paid"', async () => {
    const cast = await castWithSentBill();

    expect(await setPayment(cast, cast.guestB, "confirm")).toBe("confirmed");

    expect(await myBill(cast, cast.guestB)).toMatchObject({
      status: "paid",
      owed: 0,
    });
  });

  it("undo clears a confirmation and the guest owes again", async () => {
    const cast = await castWithSentBill();
    await setPayment(cast, cast.guestA, "confirm");

    expect(await setPayment(cast, cast.guestA, "undo")).toBe("undone");

    expect(await myBill(cast, cast.guestA)).toMatchObject({
      status: "owes",
      confirmed: 0,
      owed: 345,
    });
    expect(await iPaid(cast, cast.guestA, true)).toBe("updated");
  });

  it("leaves the guest owing only the difference after a later purchase", async () => {
    const cast = await castWithSentBill();
    await iPaid(cast, cast.guestB, true);
    await setPayment(cast, cast.guestB, "confirm");

    await updateCosts(cast, [
      { name: "Drinks", price: 450, sharers: [cast.guestA.id, cast.guestB.id] },
      { name: "Pizza", price: 90, sharers: [cast.guestB.id] },
    ]);

    expect(await myBill(cast, cast.guestB)).toMatchObject({
      total: 315,
      confirmed: 225,
      owed: 90,
      status: "owes",
    });
    // They can say they paid the rest, and the host confirms the new total.
    expect(await iPaid(cast, cast.guestB, true)).toBe("updated");
    expect(await myBill(cast, cast.guestB)).toMatchObject({
      status: "says_paid",
    });
    await setPayment(cast, cast.guestB, "confirm");
    expect(await myBill(cast, cast.guestB)).toMatchObject({
      confirmed: 315,
      owed: 0,
      status: "paid",
    });
  });

  it("answers costs_off, not_found and invalid without changing anything", async () => {
    const cast = await castWithSentBill();

    expect(await setPayment(cast, cast.host, "confirm")).toBe("not_found");
    expect(await setPayment(cast, cast.tv, "confirm")).toBe("not_found");
    expect(await setPayment(cast, cast.guestA, "pay")).toBe("invalid");

    await serviceClient().rpc("update_costs", {
      target_event_id: cast.event.id,
      costs: null,
    });
    expect(await setPayment(cast, cast.guestA, "confirm")).toBe("costs_off");
  });

  it("works once the event has ended, and answers not_found once expired", async () => {
    const cast = await castWithSentBill();
    await serviceClient()
      .from("events")
      .update({ status: "ended" })
      .eq("id", cast.event.id);
    expect(await setPayment(cast, cast.guestA, "confirm")).toBe("confirmed");

    await expireEvent(cast.event.id);
    expect(await setPayment(cast, cast.guestA, "undo")).toBe("not_found");
  });

  it("can't be called by a client", async () => {
    const cast = await castWithSentBill();
    for (const user of [cast.host, cast.guestA, cast.tv, cast.nonMember]) {
      const { error } = await user.client.rpc("set_payment", {
        target_event_id: cast.event.id,
        target_user_id: cast.guestA.id,
        change: "confirm",
      });
      expect(error).not.toBeNull();
    }
    expect(await myBill(cast, cast.guestA)).toMatchObject({ status: "owes" });
  });
});

describe("who can read payments", () => {
  it("lets the host read every row, and no guest or TV any", async () => {
    const cast = await castWithSentBill();
    await iPaid(cast, cast.guestA, true);
    await setPayment(cast, cast.guestB, "confirm");

    const host = await cast.host.client.from("cost_payments").select("*");
    expect(host.data).toHaveLength(2);

    for (const user of [cast.guestA, cast.guestB, cast.tv, cast.nonMember]) {
      const { data } = await user.client.from("cost_payments").select("*");
      expect(data).toEqual([]);
    }
  });

  it("lets nobody write the table directly", async () => {
    const cast = await castWithSentBill();
    for (const user of [cast.host, cast.guestA, cast.tv]) {
      const insert = await user.client.from("cost_payments").insert({
        event_id: cast.event.id,
        user_id: cast.guestA.id,
        confirmed_kr: 345,
        confirmed_at: new Date().toISOString(),
      });
      expect(insert.error).not.toBeNull();
    }
    expect(await myBill(cast, cast.guestA)).toMatchObject({ status: "owes" });
  });

  it("never shows a guest anything about another guest's payment", async () => {
    const cast = await castWithSentBill();
    await setPayment(cast, cast.guestA, "confirm");

    const text = JSON.stringify(await myBill(cast, cast.guestB));

    expect(text).not.toContain(cast.guestA.id);
    expect(await myBill(cast, cast.guestB)).toMatchObject({ status: "owes" });
  });
});

describe("the live signal", () => {
  it("goes up when a guest says they paid and when the host confirms", async () => {
    const cast = await castWithSentBill();
    const version = async () => {
      const { data } = await serviceClient()
        .from("events")
        .select("costs_version")
        .eq("id", cast.event.id)
        .single();
      return data?.costs_version ?? -1;
    };
    const start = await version();

    await iPaid(cast, cast.guestA, true);
    expect(await version()).toBe(start + 1);
    await setPayment(cast, cast.guestA, "confirm");
    expect(await version()).toBe(start + 2);
  });
});
