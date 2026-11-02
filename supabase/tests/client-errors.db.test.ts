// #224: browsers write error rows only through log_client_error; nobody
// reads or writes the table directly; rows older than 14 days are cleaned.
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

function log(user: User, args: Record<string, string | undefined> = {}) {
  return user.client.rpc("log_client_error", {
    kind: "handled",
    area: "swish",
    ...args,
  });
}

function rowsOf(area: string): string[] {
  return sql(`select id from public.client_errors where area = '${area}'`);
}

describe("direct access to client_errors", () => {
  it("is refused for every role", async () => {
    for (const user of [
      cast.guestA,
      cast.tv,
      cast.host,
      cast.nonMember,
    ] as User[]) {
      const select = await user.client.from("client_errors").select();
      expect(select.data ?? []).toEqual([]);
      const insert = await user.client
        .from("client_errors")
        .insert({ kind: "error", area: "direct-insert" });
      expect(insert.error).not.toBeNull();
      const update = await user.client
        .from("client_errors")
        .update({ area: "x" })
        .eq("area", "swish");
      expect(update.error).not.toBeNull();
      const del = await user.client
        .from("client_errors")
        .delete()
        .eq("area", "swish");
      expect(del.error).not.toBeNull();
    }
    expect(rowsOf("direct-insert")).toEqual([]);
  });
});

describe("log_client_error", () => {
  it("stores a valid row from a guest, a TV and a host session", async () => {
    for (const [user, area] of [
      [cast.guestA, "guest-ok"],
      [cast.tv, "tv-ok"],
      [cast.host, "host-ok"],
    ] as const) {
      const { data, error } = await log(user, { area, action: "open_app" });
      expect(error).toBeNull();
      expect(data).toBe("logged");
      expect(rowsOf(area)).toHaveLength(1);
    }
  });

  it("is not callable without a session", async () => {
    const { data, error } = await signedOutClient().rpc("log_client_error", {
      kind: "handled",
      area: "signed-out",
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(rowsOf("signed-out")).toEqual([]);
  });

  it("answers invalid_kind for an unknown kind and stores nothing", async () => {
    const user = await anonymousUser();
    for (const kind of ["warning", "", "ERROR"]) {
      const { data } = await log(user, { kind, area: "bad-kind" });
      expect(data).toBe("invalid_kind");
    }
    expect(rowsOf("bad-kind")).toEqual([]);
  });

  it("accepts all four kinds", async () => {
    const user = await anonymousUser();
    for (const kind of ["error", "rejection", "render", "handled"]) {
      expect((await log(user, { kind, area: "kinds" })).data).toBe("logged");
    }
    expect(rowsOf("kinds")).toHaveLength(4);
  });

  it("cuts every text to a fixed length", async () => {
    const user = await anonymousUser();
    const long = "x".repeat(5000);
    await log(user, {
      area: long,
      action: long,
      error_code: long,
      message: long,
      stack: long,
      route: "/" + long,
      event_code: long,
      app_version: long,
    });
    const [row] = sql(
      "select concat_ws(',', char_length(area), char_length(action), " +
        "char_length(error_code), char_length(message), char_length(stack), " +
        "char_length(route), char_length(event_code), char_length(app_version)) " +
        `from public.client_errors where area = '${"x".repeat(40)}'`,
    );
    expect(row).toBe("40,60,60,300,1000,200,20,40");
  });

  it("stores the route without query or fragment", async () => {
    const user = await anonymousUser();
    for (const route of [
      "/host/ABCD#key=secret",
      "/p/ABCD?name=Anna",
      "/p/ABCD?x=1#key=secret",
    ]) {
      await log(user, { area: "route", route });
    }
    expect(
      sql("select route from public.client_errors where area = 'route'").sort(),
    ).toEqual(["/host/ABCD", "/p/ABCD", "/p/ABCD"]);
    expect(
      sql(
        "select count(*) from public.client_errors where route like '%secret%' or route like '%Anna%'",
      ),
    ).toEqual(["0"]);
  });

  it("refuses more than 20 rows a minute per user and stores nothing extra", async () => {
    const user = await anonymousUser();
    const other = await anonymousUser();
    for (let i = 0; i < 20; i++) {
      expect((await log(user, { area: "flood" })).data).toBe("logged");
    }
    expect((await log(user, { area: "flood" })).data).toBe("rate_limited");
    expect(rowsOf("flood")).toHaveLength(20);
    // The limit is per user.
    expect((await log(other, { area: "flood-other" })).data).toBe("logged");
    // A new minute starts a new window.
    sql(
      `update private.rate_limits set window_start = window_start - interval '61 seconds' ` +
        `where user_id = '${user.id}' and action = 'log_client_error'`,
    );
    expect((await log(user, { area: "flood" })).data).toBe("logged");
  });

  it("answers invalid for an empty area", async () => {
    const user = await anonymousUser();
    expect((await log(user, { area: "  " })).data).toBe("invalid");
  });

  it("stores the event code as plain text, with no foreign key to events", () => {
    expect(
      sql(
        "select count(*) from pg_constraint where contype = 'f' " +
          "and conrelid = 'public.client_errors'::regclass",
      ),
    ).toEqual(["0"]);
  });
});

describe("cleanup of client_errors", () => {
  it("deletes rows older than 14 days and keeps newer ones", () => {
    sql(
      "insert into public.client_errors (kind, area, created_at) values " +
        "('error', 'cleanup-old', now() - interval '15 days'), " +
        "('error', 'cleanup-new', now() - interval '13 days')",
    );
    const counts = JSON.parse(
      sql("select private.cleanup_expired()")[0] ?? "",
    ) as { client_errors: number };
    expect(counts.client_errors).toBeGreaterThanOrEqual(1);
    expect(rowsOf("cleanup-old")).toEqual([]);
    expect(rowsOf("cleanup-new")).toHaveLength(1);
  });
});
