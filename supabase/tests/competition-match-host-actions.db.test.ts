// Competitions spec (#262), ticket #265: host-actions `update_match`. Called
// over HTTP through `supabase functions serve`; the matches are read back with
// the service role.
import { describe, expect, it } from "vitest";
import { anonymousUser, serviceClient, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, setFlow, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & {
  user: User;
  eventId: string;
  competitionId: string;
  anna: string;
  bertil: string;
};

/** Creates an event with one competition and two guests who played a match. */
async function createHost(): Promise<Host & { matchId: string }> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["competitions"],
      party: {},
      competitions: [{ name: "Ping pong" }],
    },
    { user },
  );
  expect(response.status).toBe(200);
  const link = response.body as HostLink;
  const [eventId = ""] = sql(
    `select id from public.events where code = '${link.code}'`,
  );
  const [competitionId = ""] = sql(
    `select id from public.competitions where event_id = '${eventId}'`,
  );
  const [anna, bertil] = await Promise.all([anonymousUser(), anonymousUser()]);
  for (const [guest, name] of [
    [anna, "Anna"],
    [bertil, "Bertil"],
  ] as const) {
    sql(
      `insert into public.members (event_id, user_id, role, display_name) ` +
        `values ('${eventId}', '${guest.id}', 'guest', '${name}')`,
    );
  }
  const { data, error } = await serviceClient()
    .from("competition_matches")
    .insert({
      event_id: eventId,
      competition_id: competitionId,
      winner_id: anna.id,
      loser_id: bertil.id,
      winner_score: 21,
      loser_score: 15,
      reporter_id: anna.id,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return {
    ...link,
    user,
    eventId,
    competitionId,
    anna: anna.id,
    bertil: bertil.id,
    matchId: data?.id ?? "",
  };
}

function update(host: Host, change: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "update_match", code: link.code, key: link.key, change },
    { user: host.user },
  );
}

async function matches(host: Host) {
  const { data } = await serviceClient()
    .from("competition_matches")
    .select("id, winner_id, loser_id, winner_score, loser_score")
    .eq("event_id", host.eventId);
  return data ?? [];
}

describe("update_match with the right key", () => {
  it("fixes the winner and the score, answering {}", async () => {
    const host = await createHost();

    const response = await update(host, {
      type: "edit",
      id: host.matchId,
      winnerId: host.bertil,
      score: { winner: 21, loser: 19 },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await matches(host)).toEqual([
      {
        id: host.matchId,
        winner_id: host.bertil,
        loser_id: host.anna,
        winner_score: 21,
        loser_score: 19,
      },
    ]);
  });

  it("clears the score when none is sent", async () => {
    const host = await createHost();

    const response = await update(host, {
      type: "edit",
      id: host.matchId,
      winnerId: host.anna,
    });

    expect(response.status).toBe(200);
    expect(await matches(host)).toMatchObject([
      { winner_score: null, loser_score: null },
    ]);
  });

  it("deletes the match", async () => {
    const host = await createHost();

    const response = await update(host, { type: "delete", id: host.matchId });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await matches(host)).toEqual([]);
  });

  it("refuses a winner who didn't play it and scores that disagree", async () => {
    const host = await createHost();
    const stranger = await anonymousUser();
    for (const change of [
      { type: "edit", id: host.matchId, winnerId: stranger.id },
      {
        type: "edit",
        id: host.matchId,
        winnerId: host.anna,
        score: { winner: 3, loser: 9 },
      },
      {
        type: "edit",
        id: host.matchId,
        winnerId: host.anna,
        score: { winner: 1000, loser: 1 },
      },
      { type: "edit", id: host.matchId, winnerId: "not-a-uuid" },
      { type: "move", id: host.matchId },
    ]) {
      const response = await update(host, change);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid_request" });
    }
    expect(await matches(host)).toMatchObject([
      { winner_id: host.anna, winner_score: 21 },
    ]);
  });

  it("answers not_found for a match of another event", async () => {
    const [host, other] = await Promise.all([createHost(), createHost()]);

    for (const change of [
      {
        type: "edit",
        id: other.matchId,
        winnerId: other.bertil,
      },
      { type: "delete", id: other.matchId },
      { type: "delete", id: "00000000-0000-4000-8000-000000000000" },
    ]) {
      const response = await update(host, change);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    }
    expect(await matches(other)).toMatchObject([
      { winner_id: other.anna, winner_score: 21 },
    ]);
  });

  it("refuses with module_disabled while Competitions is off", async () => {
    const host = await createHost();
    await callHostActions(
      {
        action: "set_modules",
        code: host.code,
        key: host.key,
        modules: ["quiz"],
      },
      { user: host.user },
    );

    const response = await update(host, { type: "delete", id: host.matchId });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "module_disabled" });
    expect(await matches(host)).toHaveLength(1);
  });

  it("refuses with invalid_transition after the evening ended", async () => {
    const host = await createHost();
    await setFlow(host, { type: "end_event" });

    const response = await update(host, { type: "delete", id: host.matchId });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "invalid_transition" });
    expect(await matches(host)).toHaveLength(1);
  });
});

describe("update_match without the right key", () => {
  async function expectRefused(
    host: Host & { matchId: string },
    link: HostLink,
  ) {
    const response = await update(
      host,
      { type: "delete", id: host.matchId },
      link,
    );
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
    expect(await matches(host)).toHaveLength(1);
  }

  it("refuses a wrong key", async () => {
    const host = await createHost();
    await expectRefused(host, { code: host.code, key: otherKey(host.key) });
  });

  it("refuses the key of another event", async () => {
    const [host, other] = await Promise.all([createHost(), createHost()]);
    await expectRefused(host, { code: host.code, key: other.key });
  });

  it("answers a wrong key, an unknown code and an unknown match alike", async () => {
    const host = await createHost();
    const change = {
      type: "delete",
      id: "00000000-0000-4000-8000-000000000000",
    };
    const wrongKey = await update(host, change, {
      code: host.code,
      key: otherKey(host.key),
    });
    const unknownCode = await update(host, change, {
      code: unusedCode(),
      key: host.key,
    });
    expect(wrongKey.status).toBe(403);
    expect(unknownCode.status).toBe(wrongKey.status);
    expect(unknownCode.text).toBe(wrongKey.text);
  });

  it("refuses a caller who is not signed in", async () => {
    const host = await createHost();
    const response = await callHostActions({
      action: "update_match",
      code: host.code,
      key: host.key,
      change: { type: "delete", id: host.matchId },
    });
    expect(response.status).toBe(401);
    expect(await matches(host)).toHaveLength(1);
  });

  it("refuses an expired event", async () => {
    const host = await createHost();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${host.eventId}'`,
    );
    const response = await update(host, { type: "delete", id: host.matchId });
    expect(response.status).toBe(403);
    expect(response.text).toBe('{"error":"not_authorized"}');
  });
});

describe("rate limit on update_match", () => {
  const limit = 30;

  it(`allows ${limit} fixes per user and event, then refuses`, async () => {
    const host = await createHost();
    for (let i = 0; i < limit; i++) {
      expect(
        (
          await update(host, {
            type: "edit",
            id: host.matchId,
            winnerId: host.anna,
            score: { winner: 30, loser: i % 20 },
          })
        ).status,
      ).toBe(200);
    }

    const response = await update(host, { type: "delete", id: host.matchId });

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "rate_limited" });
    expect(await matches(host)).toHaveLength(1);
  });
});
