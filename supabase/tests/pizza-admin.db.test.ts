// Pizza admin: every admin function checks the secret key first; a wrong key,
// no key and no session all get the same refusal; the key itself is only
// stored as a hash in a server-only table.
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  seedCast,
  signedOutClient,
  sql,
  type Cast,
  type User,
} from "./helpers";

// A test key: the real key's hash is in the migration, the key is not in the repo.
const testKey = "t".repeat(43);
const wrongKey = "w".repeat(43);
let cast: Cast;
let originalHash: string;

beforeAll(async () => {
  cast = await seedCast();
  originalHash = sql("select key_hash from private.pizza_admin")[0] ?? "";
  const hash = createHash("sha256").update(testKey).digest("hex");
  sql(`update private.pizza_admin set key_hash = '${hash}'`);
  return () => {
    sql(`update private.pizza_admin set key_hash = '${originalHash}'`);
  };
});

function seedOrder(name: string): string {
  return (
    sql(
      `insert into public.pizza_orders (name, pizza) values ('${name}', 'Test') returning id`,
    )[0] ?? ""
  );
}

function orders(user: User, key: string = testKey) {
  return user.client.rpc("pizza_admin_orders", { admin_key: key });
}

describe("private.pizza_admin", () => {
  it("is not readable through the API", async () => {
    for (const user of [cast.guestA, cast.host, cast.nonMember] as User[]) {
      const read = await user.client
        .schema("private" as never)
        .from("pizza_admin" as never)
        .select();
      expect(read.error).not.toBeNull();
    }
  });
});

describe("pizza_admin_orders", () => {
  it("lists orders, newest first, for the right key", async () => {
    seedOrder("AdminListOne");
    seedOrder("AdminListTwo");
    const user = await anonymousUser();
    const { data, error } = await orders(user);
    expect(error).toBeNull();
    const list = (data as { orders: { name: string; done: boolean }[] }).orders;
    const names = list.map((o) => o.name);
    expect(names.indexOf("AdminListTwo")).toBeLessThan(
      names.indexOf("AdminListOne"),
    );
    expect(list.every((o) => o.done === false)).toBe(true);
  });

  it("refuses a wrong key, an empty key and a missing key the same way", async () => {
    const user = await anonymousUser();
    for (const key of [wrongKey, "", "x"]) {
      expect((await orders(user, key)).data).toEqual({ error: "forbidden" });
    }
  });

  it("is not callable without a session", async () => {
    const { data, error } = await signedOutClient().rpc("pizza_admin_orders", {
      admin_key: testKey,
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("pizza_admin_set_done", () => {
  it("marks an order as ordered and back", async () => {
    const id = seedOrder("AdminDone");
    const user = await anonymousUser();
    const call = (done: boolean, key: string = testKey) =>
      user.client.rpc("pizza_admin_set_done", {
        admin_key: key,
        order_id: id,
        done,
      });
    expect((await call(true)).data).toBe("ok");
    expect(
      sql(`select done from public.pizza_orders where id = '${id}'`),
    ).toEqual(["t"]);
    expect((await call(false)).data).toBe("ok");
    expect((await call(true, wrongKey)).data).toBe("forbidden");
    expect(
      sql(`select done from public.pizza_orders where id = '${id}'`),
    ).toEqual(["f"]);
  });

  it("answers not_found for an unknown order", async () => {
    const user = await anonymousUser();
    const { data } = await user.client.rpc("pizza_admin_set_done", {
      admin_key: testKey,
      order_id: "00000000-0000-4000-8000-000000000000",
      done: true,
    });
    expect(data).toBe("not_found");
  });
});

describe("pizza_admin_delete", () => {
  it("deletes one order with the right key and keeps it with a wrong one", async () => {
    const id = seedOrder("AdminDelete");
    const user = await anonymousUser();
    const call = (key: string) =>
      user.client.rpc("pizza_admin_delete", { admin_key: key, order_id: id });
    expect((await call(wrongKey)).data).toBe("forbidden");
    expect(sql(`select 1 from public.pizza_orders where id = '${id}'`)).toEqual(
      ["1"],
    );
    expect((await call(testKey)).data).toBe("ok");
    expect(sql(`select 1 from public.pizza_orders where id = '${id}'`)).toEqual(
      [],
    );
    expect((await call(testKey)).data).toBe("not_found");
  });
});

describe("pizza_admin_clear", () => {
  it("deletes every order only with the right key", async () => {
    seedOrder("AdminClear");
    const user = await anonymousUser();
    expect(
      (await user.client.rpc("pizza_admin_clear", { admin_key: wrongKey }))
        .data,
    ).toBe("forbidden");
    expect(sql("select count(*) from public.pizza_orders")[0]).not.toBe("0");
    expect(
      (await user.client.rpc("pizza_admin_clear", { admin_key: testKey })).data,
    ).toBe("ok");
    expect(sql("select count(*) from public.pizza_orders")).toEqual(["0"]);
  });
});

describe("rate limit", () => {
  it("answers rate_limited after 120 calls in 10 minutes", async () => {
    const user = await anonymousUser();
    for (let i = 0; i < 120; i++) await orders(user, wrongKey);
    expect((await orders(user)).data).toEqual({ error: "rate_limited" });
  });
});
