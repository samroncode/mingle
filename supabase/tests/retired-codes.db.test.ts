// #85: codes of deleted events are retired and never given to a new event.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  randomCode,
  serviceClient,
  signedOutClient,
  sql,
} from "./helpers";

/** Calls create_event as host-actions does, with the service role. */
function createEvent(caller: string, code: string) {
  return serviceClient().rpc("create_event", {
    caller,
    code,
    niche: "aw",
    language: "sv",
    enabled_modules: ["quiz", "awards", "hottakes"],
    party: {},
    admin_key_hash: "0".repeat(64),
    quiz: [{ text: "Fråga?", options: ["a", "b", "c", "d"], correct: 0 }],
    awards: [{ text: "Mest sannolik att dansa" }],
    hottakes: [{ text: "Ananas hör hemma på pizza" }],
  });
}

/** Rows of every table create_event writes to, for this code or caller. */
function rowsFor(code: string, caller: string) {
  return sql(
    "select " +
      `(select count(*) from public.events where code = '${code}'), ` +
      "(select count(*) from private.event_secrets s " +
      `join public.events e on e.id = s.event_id where e.code = '${code}'), ` +
      `(select count(*) from public.members where user_id = '${caller}'), ` +
      "(select count(*) from public.quiz_questions q " +
      `join public.events e on e.id = q.event_id where e.code = '${code}'), ` +
      "(select count(*) from public.award_categories a " +
      `join public.events e on e.id = a.event_id where e.code = '${code}'), ` +
      "(select count(*) from public.hot_takes h " +
      `join public.events e on e.id = h.event_id where e.code = '${code}')`,
  )[0];
}

function retire(code: string) {
  sql(`insert into private.retired_codes (code) values ('${code}')`);
}

describe("create_event and retired codes", () => {
  it("answers null for a retired code and creates nothing", async () => {
    const host = await anonymousUser();
    const code = randomCode();
    retire(code);

    const { data, error } = await createEvent(host.id, code);
    expect(error).toBeNull();
    expect(data).toBeNull();
    expect(rowsFor(code, host.id)).toBe("0|0|0|0|0|0");
  });

  it("still creates an event with a free code", async () => {
    const host = await anonymousUser();
    const code = randomCode();

    const { data, error } = await createEvent(host.id, code);
    expect(error).toBeNull();
    expect(data).toEqual(expect.any(String));
    expect(rowsFor(code, host.id)).toBe("1|1|1|1|1|1");
  });

  it("is still security definer, with an empty search_path", () => {
    expect(
      sql(
        "select prosecdef, proconfig from pg_proc " +
          "where oid = 'public.create_event(uuid, text, text, text, text[], " +
          "jsonb, text, jsonb, jsonb, jsonb, jsonb)'::regprocedure",
      ),
    ).toEqual(['t|{"search_path=\\"\\""}']);
  });

  it("is still callable by no client role", async () => {
    const guest = await anonymousUser();
    for (const client of [guest.client, signedOutClient()]) {
      const { error } = await client.rpc("create_event", {
        caller: guest.id,
        code: randomCode(),
        niche: "aw",
        language: "sv",
        enabled_modules: [],
        party: {},
        admin_key_hash: "0".repeat(64),
      });
      expect(error?.code).toBe("42501");
    }
  });
});

describe("private.retired_codes", () => {
  it("keeps codes in the same shape as event codes", () => {
    for (const code of ["abcdef", "ABC0EF", "ABCDE", "ABCDEFG"]) {
      expect(() => retire(code)).toThrow(/retired_codes_code_check/);
    }
  });

  it("holds each code once", () => {
    const code = randomCode();
    retire(code);
    expect(() => retire(code)).toThrow(/retired_codes_pkey/);
  });

  it.each(["anon", "authenticated"])(
    "gives the %s role no access, even if the schema were exposed",
    (role) => {
      for (const statement of [
        "select count(*) from private.retired_codes",
        "insert into private.retired_codes (code) values ('ABCDEF')",
        "update private.retired_codes set code = 'ABCDEF'",
        "delete from private.retired_codes",
      ]) {
        expect(() => sql(`set role ${role}; ${statement}`)).toThrow(
          /permission denied for schema private/,
        );
      }
    },
  );

  it("can't be read or changed through the API", async () => {
    const guest = await anonymousUser();
    for (const client of [guest.client, signedOutClient()]) {
      const table = () =>
        client.schema("private" as "public").from("retired_codes" as "events");
      const read = await table().select();
      expect(read.error).not.toBeNull();
      expect(read.data).toBeNull();
      const write = await table().insert({ code: randomCode() } as never);
      expect(write.error).not.toBeNull();
      const remove = await table().delete().neq("code", "");
      expect(remove.error).not.toBeNull();
    }
  });
});
