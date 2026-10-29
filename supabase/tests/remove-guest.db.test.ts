// Host control panel spec (#75), ticket #80: host-actions `remove_guest`, the
// host removing a guest. Called over HTTP through `supabase functions serve`;
// what the database then does is in removed-guest.db.test.ts. That the RPC
// isn't callable by clients is here.
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

function remove(
  cast: Cast,
  userId: string,
  link: HostLink = cast,
  user: User = cast.user,
) {
  return callHostActions(
    { action: "remove_guest", code: link.code, key: link.key, userId },
    { user },
  );
}

/** The ids of the guests not removed, as the TV sees them. */
async function guestsOf(cast: Cast): Promise<string[]> {
  const { data, error } = await cast.tv.client
    .from("members")
    .select("display_name")
    .eq("event_id", cast.eventId)
    .eq("role", "guest")
    .order("display_name");
  if (error) throw error;
  return data.map((row) => row.display_name ?? "");
}

describe("remove_guest", () => {
  it("removes the guest and answers {}", async () => {
    const cast = await createCast();

    const response = await remove(cast, cast.anna.id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await guestsOf(cast)).toEqual(["Bertil"]);
    const join = await cast.anna.client.rpc("join_event", {
      code: cast.code,
      display_name: "Anna",
    });
    expect(join.data).toEqual({ event_id: null, error: "removed" });
  });

  it("answers not_found when the guest is removed twice", async () => {
    const cast = await createCast();
    expect((await remove(cast, cast.anna.id)).status).toBe(200);

    const response = await remove(cast, cast.anna.id);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("answers invalid_request for a user id that isn't a uuid", async () => {
    const cast = await createCast();

    const response = await remove(cast, "anna");

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
      const response = await remove(cast, userId);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
    expect(await guestsOf(cast)).toEqual(["Anna", "Bertil"]);
    expect(
      sql(
        `select count(*) from public.members where event_id = '${cast.eventId}' and removed_at is not null`,
      ),
    ).toEqual(["0"]);
  });

  it("answers not_found for a guest of another event, and leaves them alone", async () => {
    const [cast, other] = await Promise.all([createCast(), createCast()]);

    const response = await remove(cast, other.anna.id);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
    expect(await guestsOf(other)).toEqual(["Anna", "Bertil"]);
  });

  it("answers invalid_transition once the event has ended", async () => {
    const cast = await createCast();
    expect((await setFlow(cast, { type: "end_event" })).status).toBe(200);

    const response = await remove(cast, cast.anna.id);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await guestsOf(cast)).toEqual(["Anna", "Bertil"]);
  });
});

describe("remove_guest without the right key", () => {
  async function expectRefused(cast: Cast, link: HostLink, user?: User) {
    const response = await remove(cast, cast.anna.id, link, user);
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await guestsOf(cast)).toEqual(["Anna", "Bertil"]);
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
    const wrongKey = await remove(cast, cast.anna.id, {
      code: cast.code,
      key: otherKey(cast.key),
    });
    const unknown = await remove(cast, cast.anna.id, {
      code: unusedCode(),
      key: cast.key,
    });
    expect(wrongKey.status).toBe(unknown.status);
    expect(wrongKey.text).toBe(unknown.text);
  });

  it("refuses an expired event", async () => {
    const cast = await createCast();
    sql(
      `update public.events set expires_at = now() - interval '1 second' where id = '${cast.eventId}'`,
    );

    const response = await remove(cast, cast.anna.id);

    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(
      sql(
        `select count(*) from public.members where event_id = '${cast.eventId}' and removed_at is not null`,
      ),
    ).toEqual(["0"]);
  });
});

describe("rate limit on remove_guest", () => {
  const limit = 30;

  it(`allows ${limit} calls per user and event, then refuses`, async () => {
    const cast = await createCast();
    const unknown = "00000000-0000-0000-0000-000000000000";
    for (let i = 0; i < limit; i++) {
      expect((await remove(cast, unknown)).status).toBe(404);
    }

    const response = await remove(cast, cast.anna.id);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await guestsOf(cast)).toEqual(["Anna", "Bertil"]);
  });

  it("counts under remove_guest and the event's id, after the key check", async () => {
    const cast = await createCast();
    await remove(cast, cast.anna.id, {
      code: cast.code,
      key: otherKey(cast.key),
    });
    await remove(cast, cast.anna.id);

    expect(
      sql(
        `select action, count from private.rate_limits where user_id = '${cast.user.id}' and action like 'remove_guest%'`,
      ),
    ).toEqual([`remove_guest:${cast.eventId}|1`]);
  });
});

describe("remove_guest as an RPC", () => {
  it("can't be called by a guest, a host, a TV or a signed-out client", async () => {
    const cast = await createCast();
    const args = {
      target_event_id: cast.eventId,
      target_user_id: cast.bertil.id,
    };

    for (const client of [cast.anna.client, cast.user.client, cast.tv.client]) {
      const { error } = await client.rpc("remove_guest", args);
      expect(error).not.toBeNull();
    }
    expect(await guestsOf(cast)).toEqual(["Anna", "Bertil"]);
  });

  it("is callable with the service role", async () => {
    const cast = await createCast();

    const { data, error } = await serviceClient().rpc("remove_guest", {
      target_event_id: cast.eventId,
      target_user_id: cast.bertil.id,
    });

    expect(error).toBeNull();
    expect(data).toBe("removed");
  });
});
