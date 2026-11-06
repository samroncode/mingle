// Pizza page: nobody reads or writes pizza_orders directly; orders go through
// submit_pizza_order; orders older than the retention period are cleaned.
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  seedCast,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

let cast: Cast;

beforeAll(async () => {
  cast = await seedCast();
});

function order(user: User, args: Record<string, string | undefined> = {}) {
  return user.client.rpc("submit_pizza_order", {
    name: "Anna",
    pizza: "Capricciosa",
    ...args,
  });
}

function rowsOf(name: string): string[] {
  return sql(`select id from public.pizza_orders where name = '${name}'`);
}

describe("direct access to pizza_orders", () => {
  it("is refused for every role", async () => {
    for (const user of [
      cast.guestA,
      cast.tv,
      cast.host,
      cast.nonMember,
    ] as User[]) {
      const select = await user.client.from("pizza_orders").select();
      expect(select.data ?? []).toEqual([]);
      const insert = await user.client
        .from("pizza_orders")
        .insert({ name: "direct", pizza: "x" });
      expect(insert.error).not.toBeNull();
      const update = await user.client
        .from("pizza_orders")
        .update({ name: "x" })
        .eq("name", "Anna");
      expect(update.error).not.toBeNull();
      const del = await user.client
        .from("pizza_orders")
        .delete()
        .eq("name", "Anna");
      expect(del.error).not.toBeNull();
    }
    expect(rowsOf("direct")).toEqual([]);
  });
});

describe("submit_pizza_order", () => {
  it("stores a trimmed order from an anonymous user", async () => {
    const user = await anonymousUser();
    const { data, error } = await order(user, {
      name: "  Stored  ",
      note: "  no onion ",
    });
    expect(error).toBeNull();
    expect(data).toBe("ok");
    expect(
      sql(
        "select pizza || '|' || note from public.pizza_orders where name = 'Stored'",
      ),
    ).toEqual(["Capricciosa|no onion"]);
  });

  it("is not callable without a session", async () => {
    const { data, error } = await signedOutClient().rpc("submit_pizza_order", {
      name: "Signedout",
      pizza: "x",
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(rowsOf("Signedout")).toEqual([]);
  });

  it("answers invalid for an empty name or pizza", async () => {
    const user = await anonymousUser();
    for (const args of [{ name: "  " }, { pizza: " " }]) {
      const { data } = await order(user, args);
      expect(data).toBe("invalid");
    }
  });

  it("answers rate_limited after 12 orders in an hour", async () => {
    const user = await anonymousUser();
    for (let i = 0; i < 12; i++) {
      expect((await order(user, { name: "Limited" })).data).toBe("ok");
    }
    expect((await order(user, { name: "Limited" })).data).toBe("rate_limited");
    expect(rowsOf("Limited")).toHaveLength(12);
  });

  it("cuts long texts to their limits", async () => {
    const user = await anonymousUser();
    const { data } = await order(user, {
      name: "L".repeat(80),
      note: "n".repeat(300),
    });
    expect(data).toBe("ok");
    expect(
      sql(
        `select char_length(name) || '|' || char_length(note) from public.pizza_orders where name = '${"L".repeat(40)}'`,
      ),
    ).toEqual(["40|100"]);
  });
});

describe("cleanup of pizza orders", () => {
  it("deletes orders older than 30 days and keeps newer ones", () => {
    sql(
      "insert into public.pizza_orders (name, pizza, created_at) values " +
        "('OldOrder', 'x', now() - interval '31 days'), " +
        "('NewOrder', 'x', now() - interval '1 day')",
    );
    sql("select private.cleanup_expired()");
    expect(rowsOf("OldOrder")).toEqual([]);
    expect(rowsOf("NewOrder")).toHaveLength(1);
  });
});
