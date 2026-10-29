// Host control panel spec (#75), ticket #79: host-actions `rename_guest`, the
// host giving a guest a new display name. Called over HTTP through
// `supabase functions serve`; the names are read back through the clients of
// the members. That no client can rename another guest is in
// rename.db.test.ts, and that the RPC isn't callable by clients is here.
import { describe, expect, it } from "vitest";
import {
  anonymousUser,
  anonymousUsers,
  serviceClient,
  sql,
  type User,
} from "./helpers";
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

function rename(
  cast: Cast,
  userId: string,
  name: unknown,
  link: HostLink = cast,
  user: User = cast.user,
) {
  return callHostActions(
    {
      action: "rename_guest",
      code: link.code,
      key: link.key,
      userId,
      name,
    },
    { user },
  );
}

/** Every guest name of the event as the TV sees it, A to Z. */
async function namesOf(cast: Cast): Promise<string[]> {
  const { data, error } = await cast.tv.client
    .from("members")
    .select("display_name")
    .eq("event_id", cast.eventId)
    .eq("role", "guest")
    .order("display_name");
  if (error) throw error;
  return data.map((row) => row.display_name ?? "");
}

describe("rename_guest", () => {
  it("renames the guest and answers {}, for the guest and the TV", async () => {
    const cast = await createCast();

    const response = await rename(cast, cast.anna.id, "Annika");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await namesOf(cast)).toEqual(["Annika", "Bertil"]);
    const { data } = await cast.anna.client
      .from("members")
      .select("display_name")
      .eq("user_id", cast.anna.id)
      .single();
    expect(data?.display_name).toBe("Annika");
  });

  it("cleans the name like joining does", async () => {
    const cast = await createCast();

    expect((await rename(cast, cast.anna.id, "  Annika  ")).status).toBe(200);
    expect(await namesOf(cast)).toEqual(["Annika", "Bertil"]);
  });

  it("lets a guest's answers and votes stay theirs", async () => {
    const cast = await createCast();
    sql(
      `insert into public.hot_takes (event_id, position, text) ` +
        `values ('${cast.eventId}', 0, 'Take')`,
    );
    sql(
      `insert into public.hot_take_answers (event_id, hot_take_id, guest_id, agree) ` +
        `select '${cast.eventId}', id, '${cast.anna.id}', true ` +
        `from public.hot_takes where event_id = '${cast.eventId}'`,
    );

    expect((await rename(cast, cast.anna.id, "Annika")).status).toBe(200);

    expect(
      sql(
        `select guest_id from public.hot_take_answers ` +
          `where event_id = '${cast.eventId}'`,
      ),
    ).toEqual([cast.anna.id]);
  });

  it("accepts the guest's own name in another case", async () => {
    const cast = await createCast();

    expect((await rename(cast, cast.anna.id, "ANNA")).status).toBe(200);
    expect(await namesOf(cast)).toEqual(["ANNA", "Bertil"]);
  });

  it("answers name_taken for another guest's name, ignoring case", async () => {
    const cast = await createCast();

    const response = await rename(cast, cast.anna.id, "bertil");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "name_taken" });
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
  });

  it.each([
    ["empty", ""],
    ["only spaces", "   "],
    ["31 characters", "x".repeat(31)],
    ["100 characters", "x".repeat(100)],
  ])("answers invalid_name for a name that is %s", async (_, name) => {
    const cast = await createCast();

    const response = await rename(cast, cast.anna.id, name);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_name" });
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
  });

  it.each([
    ["a name that isn't a string", 5],
    ["a name of more than 200 characters", "x".repeat(201)],
  ])("answers invalid_request for %s", async (_, name) => {
    const cast = await createCast();

    const response = await rename(cast, cast.anna.id, name);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });

  it("answers invalid_request for a user id that isn't a uuid", async () => {
    const cast = await createCast();

    const response = await rename(cast, "anna", "Annika");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });

  it("answers not_found for the host, the TV, an unknown user and a non-member", async () => {
    const cast = await createCast();
    const stranger = await anonymousUser();
    const targets = [
      cast.user.id,
      cast.tv.id,
      "00000000-0000-0000-0000-000000000000",
      stranger.id,
    ];

    for (const userId of targets) {
      const response = await rename(cast, userId, "Annika");
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
    expect(
      sql(
        `select count(*) from public.members ` +
          `where event_id = '${cast.eventId}' and display_name is not null`,
      ),
    ).toEqual(["2"]);
  });

  it("answers not_found for a guest of another event, and leaves them alone", async () => {
    const [cast, other] = await Promise.all([createCast(), createCast()]);

    const response = await rename(cast, other.anna.id, "Annika");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
    expect(await namesOf(other)).toEqual(["Anna", "Bertil"]);
  });

  it("answers invalid_transition once the event has ended", async () => {
    const cast = await createCast();
    expect((await setFlow(cast, { type: "end_event" })).status).toBe(200);

    const response = await rename(cast, cast.anna.id, "Annika");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
  });
});

describe("rename_guest without the right key", () => {
  async function expectRefused(cast: Cast, link: HostLink, user?: User) {
    const response = await rename(cast, cast.anna.id, "Annika", link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
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
    const wrongKey = await rename(cast, cast.anna.id, "Annika", {
      code: cast.code,
      key: otherKey(cast.key),
    });
    const unknown = await rename(cast, cast.anna.id, "Annika", {
      code: unusedCode(),
      key: cast.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses an expired event", async () => {
    const cast = await createCast();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${cast.eventId}'`,
    );

    const response = await rename(cast, cast.anna.id, "Annika");

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(
      sql(
        `select display_name from public.members ` +
          `where event_id = '${cast.eventId}' and role = 'guest' ` +
          `order by display_name`,
      ),
    ).toEqual(["Anna", "Bertil"]);
  });
});

describe("rate limit on rename_guest", () => {
  const limit = 30;

  it(`allows ${limit} renames per user and event, then refuses`, async () => {
    const cast = await createCast();
    for (let i = 0; i < limit; i++) {
      expect((await rename(cast, cast.anna.id, `Anna ${i}`)).status).toBe(200);
    }

    const response = await rename(cast, cast.anna.id, "Annika");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await namesOf(cast)).toEqual([`Anna ${limit - 1}`, "Bertil"]);
  });

  it("counts under rename_guest and the event's id, after the key check", async () => {
    const cast = await createCast();
    await rename(cast, cast.anna.id, "Annika", {
      code: cast.code,
      key: otherKey(cast.key),
    });
    await rename(cast, cast.anna.id, "Annika");

    expect(
      sql(
        `select action, count from private.rate_limits ` +
          `where user_id = '${cast.user.id}' and action like 'rename_guest%'`,
      ),
    ).toEqual([`rename_guest:${cast.eventId}|1`]);
  });

  it("counts each event on its own", async () => {
    const cast = await createCast();
    for (let i = 0; i < limit; i++) await rename(cast, cast.anna.id, `A${i}`);
    const second = await createCast();

    const response = await rename(
      second,
      second.anna.id,
      "Annika",
      second,
      cast.user,
    );

    expect(response.status).toBe(200);
  });
});

describe("rename_guest as an RPC", () => {
  it("can't be called by a guest, a host, a TV or a signed-out client", async () => {
    const cast = await createCast();
    const args = {
      target_event_id: cast.eventId,
      target_user_id: cast.bertil.id,
      new_name: "Hacked",
    };

    for (const client of [cast.anna.client, cast.user.client, cast.tv.client]) {
      const { error } = await client.rpc("rename_guest", args);
      expect(error).not.toBeNull();
    }
    expect(await namesOf(cast)).toEqual(["Anna", "Bertil"]);
  });

  it("is callable with the service role", async () => {
    const cast = await createCast();

    const { data, error } = await serviceClient().rpc("rename_guest", {
      target_event_id: cast.eventId,
      target_user_id: cast.bertil.id,
      new_name: "Bert",
    });

    expect(error).toBeNull();
    expect(data).toBe("renamed");
  });
});
