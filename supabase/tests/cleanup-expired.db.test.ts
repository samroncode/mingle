// #86: the nightly cleanup deletes expired events and everything in them,
// stale counters and unused anonymous logins, and nothing else.
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  seedAwardCategory,
  seedHotTake,
  seedCast,
  seedQuizQuestion,
  signedOutClient,
  sql,
  serviceClient,
  type Cast,
} from "./helpers";

type Counts = {
  events: number;
  codes_retired: number;
  rate_limits: number;
  users: number;
};

/** Runs the cleanup as the database owner and returns its counts. */
function runCleanup(): Counts {
  return JSON.parse(sql("select private.cleanup_expired()")[0] ?? "") as Counts;
}

const zeros: Counts = { events: 0, codes_retired: 0, rate_limits: 0, users: 0 };

/** Every table with a foreign key to public.events, from the catalog. */
function eventTables(): string[] {
  return sql(
    "select distinct c.conrelid::regclass::text from pg_constraint c " +
      "where c.contype = 'f' and c.confrelid = 'public.events'::regclass",
  );
}

/** Rows referencing the event across all of those tables. */
function rowsOf(eventId: string): number {
  return eventTables().reduce(
    (sum, table) =>
      sum +
      Number(
        sql(`select count(*) from ${table} where event_id = '${eventId}'`)[0],
      ),
    0,
  );
}

function age(eventId: string) {
  sql(
    `update public.events set expires_at = now() - interval '1 minute' where id = '${eventId}'`,
  );
}

function limitRows(where: string): number {
  return Number(
    sql(`select count(*) from private.rate_limits where ${where}`)[0],
  );
}

function userExists(id: string): boolean {
  return sql(`select 1 from auth.users where id = '${id}'`).length === 1;
}

/** Makes a login look unused for 31 days. */
function makeStale(userId: string) {
  sql(
    `update auth.users set created_at = now() - interval '31 days', ` +
      `last_sign_in_at = now() - interval '31 days' where id = '${userId}'`,
  );
  sql(
    `update auth.sessions set created_at = now() - interval '31 days', ` +
      `updated_at = now() - interval '31 days', ` +
      `refreshed_at = now() - interval '31 days' where user_id = '${userId}'`,
  );
}

let cast: Cast;

beforeAll(() => {
  // Clear leftovers of earlier test files, so the counts below are exact.
  runCleanup();
});

describe("private.cleanup_expired", () => {
  beforeAll(async () => {
    cast = await seedCast();
    const { event, otherEvent } = cast;
    for (const e of [event, otherEvent]) {
      await seedQuizQuestion(e.id, 0);
      await seedAwardCategory(e.id, 0);
      await seedHotTake(e.id, 0);
    }
    sql(
      "insert into private.rate_limits (user_id, action) values " +
        `('${cast.host.id}', 'update_party_content:${event.id}'), ` +
        `('${cast.host.id}', 'join'), ` +
        `('${cast.otherHost.id}', 'update_party_content:${otherEvent.id}')`,
    );
    // A counter for a live event, in its window: kept. An old one: deleted.
    sql(
      "insert into private.rate_limits (user_id, action, window_start) values " +
        `('${cast.guestA.id}', 'old', now() - interval '2 days')`,
    );
    age(event.id);
  });

  let first: Counts;

  it("deletes the aged event, retires its code, leaves the other event", () => {
    const { event, otherEvent } = cast;
    expect(rowsOf(event.id)).toBeGreaterThan(0);
    const otherRows = rowsOf(otherEvent.id);

    first = runCleanup();

    expect(first).toEqual({
      events: 1,
      codes_retired: 1,
      rate_limits: 2, // the event's own counter and the old one
      users: 0,
    });
    expect(
      sql(`select count(*) from public.events where id = '${event.id}'`),
    ).toEqual(["0"]);
    expect(rowsOf(event.id)).toBe(0);
    expect(
      sql(
        `select count(*) from private.retired_codes where code = '${event.code}'`,
      ),
    ).toEqual(["1"]);
    expect(limitRows(`action = 'update_party_content:${event.id}'`)).toBe(0);
    expect(limitRows(`action = 'old'`)).toBe(0);

    expect(rowsOf(otherEvent.id)).toBe(otherRows);
    expect(
      sql(`select count(*) from public.events where id = '${otherEvent.id}'`),
    ).toEqual(["1"]);
    expect(limitRows(`action = 'update_party_content:${otherEvent.id}'`)).toBe(
      1,
    );
    expect(limitRows(`action = 'join'`)).toBeGreaterThanOrEqual(1);
  });

  it("returns all zeros on a second run", () => {
    expect(runCleanup()).toEqual(zeros);
  });

  it("leaves an event that expires in a minute alone", async () => {
    const { event } = await seedCast();
    sql(
      `update public.events set expires_at = now() + interval '1 minute' where id = '${event.id}'`,
    );
    expect(runCleanup()).toEqual(zeros);
    expect(
      sql(`select count(*) from public.events where id = '${event.id}'`),
    ).toEqual(["1"]);
  });
});

describe("unused anonymous logins", () => {
  it("deletes a stale login in no event, keeps the rest", async () => {
    const [stale, recent, member, staleMember] = [
      await anonymousUser(),
      await anonymousUser(),
      await anonymousUser(),
      await anonymousUser(),
    ];
    const { event } = await seedCast();
    await serviceClient()
      .from("members")
      .insert([
        {
          event_id: event.id,
          user_id: member.id,
          role: "guest",
          display_name: "M",
        },
        {
          event_id: event.id,
          user_id: staleMember.id,
          role: "guest",
          display_name: "N",
        },
      ]);
    for (const u of [stale, member, staleMember]) makeStale(u.id);
    // A recent session refresh keeps a login whose sign-in is old.
    makeStale(recent.id);
    sql(
      `update auth.sessions set refreshed_at = now() - interval '1 day' where user_id = '${recent.id}'`,
    );
    // A stale login that is not anonymous is never deleted.
    const permanent = await anonymousUser();
    makeStale(permanent.id);
    sql(
      `update auth.users set is_anonymous = false where id = '${permanent.id}'`,
    );

    const counts = runCleanup();

    expect(counts.users).toBe(1);
    expect(userExists(stale.id)).toBe(false);
    expect(userExists(recent.id)).toBe(true);
    expect(userExists(member.id)).toBe(true);
    expect(userExists(staleMember.id)).toBe(true);
    expect(userExists(permanent.id)).toBe(true);
  });
});

describe("access and atomicity", () => {
  it.each(["anon", "authenticated", "service_role"])(
    "can't be executed by %s",
    (role) => {
      expect(() =>
        sql(`set role ${role}; select private.cleanup_expired()`),
      ).toThrow(/permission denied/);
    },
  );

  it("can't be called through the API", async () => {
    const guest = await anonymousUser();
    for (const client of [guest.client, signedOutClient(), serviceClient()]) {
      const { error } = await client
        .schema("private" as "public")
        .rpc("cleanup_expired" as never);
      expect(error).not.toBeNull();
    }
  });

  it("is security definer, with an empty search_path", () => {
    expect(
      sql(
        "select prosecdef, proconfig from pg_proc " +
          "where oid = 'private.cleanup_expired()'::regprocedure",
      ),
    ).toEqual(['t|{"search_path=\\"\\""}']);
  });

  it("deletes nothing when a step fails", async () => {
    const { event } = await seedCast();
    age(event.id);
    // Make step 4 fail: a trigger that raises on any auth.users delete.
    const stale = await anonymousUser();
    makeStale(stale.id);
    const before = rowsOf(event.id);
    sql(
      "create or replace function public.__boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$; " +
        "create trigger boom before delete on auth.users for each row execute function public.__boom()",
    );
    try {
      expect(() => runCleanup()).toThrow(/boom/);
      expect(rowsOf(event.id)).toBe(before);
      expect(
        sql(`select count(*) from public.events where id = '${event.id}'`),
      ).toEqual(["1"]);
      expect(
        sql(
          `select count(*) from private.retired_codes where code = '${event.code}'`,
        ),
      ).toEqual(["0"]);
    } finally {
      sql("drop trigger boom on auth.users; drop function public.__boom()");
    }
    expect(runCleanup().events).toBeGreaterThanOrEqual(1);
  });
});

describe("the nightly job", () => {
  it("is scheduled once, at 03:00 UTC, under a fixed name", () => {
    expect(
      sql(
        "select schedule, command, active from cron.job " +
          "where jobname = 'cleanup-expired-events'",
      ),
    ).toEqual(["0 3 * * *|select private.cleanup_expired()|t"]);
  });
});
