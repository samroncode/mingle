// Competitions spec (#262), ticket #264: guests report matches. Members read
// the matches of their event; nobody writes the table from the client; the
// only way in is `report_match`, which checks everything the app would.
// Removing a guest also removes their matches (the function is in
// removed-guest.db.test.ts for quiz answers; matches are here).
import { beforeAll, describe, expect, it } from "vitest";
import {
  anonymousUser,
  expireEvent,
  seedCast,
  seedCompetition,
  seedMember,
  serviceClient,
  setEventStatus,
  signedOutClient,
  sql,
  type Cast,
  type Client,
  type User,
} from "./helpers";

type Report = {
  competition?: string;
  winner: string;
  loser: string;
  winnerScore?: number | null;
  loserScore?: number | null;
  eventId?: string;
};

type World = { cast: Cast; ping: string; darts: string };

/** A cast whose event has Competitions on and two competitions. */
async function world(modules: string[] = ["competitions"]): Promise<World> {
  const cast = await seedCast({ enabled_modules: modules });
  const ping = await seedCompetition(cast.event.id, 0, "Ping pong");
  const darts = await seedCompetition(cast.event.id, 1, "Darts");
  return { cast, ping, darts };
}

async function report(
  w: World,
  who: Client,
  r: Report,
): Promise<{ answer: string | null; error: { code: string } | null }> {
  const { data, error } = await who.rpc("report_match", {
    target_event_id: r.eventId ?? w.cast.event.id,
    target_competition_id: r.competition ?? w.ping,
    winner: r.winner,
    loser: r.loser,
    // The generated types leave out null; the function takes it.
    winner_score: (r.winnerScore ?? null) as number,
    loser_score: (r.loserScore ?? null) as number,
  });
  return { answer: data, error };
}

async function matchCount(w: World): Promise<number> {
  const { count, error } = await serviceClient()
    .from("competition_matches")
    .select("*", { count: "exact", head: true })
    .eq("event_id", w.cast.event.id);
  expect(error).toBeNull();
  return count ?? 0;
}

/** Seeds a match with the service role: Anna beat Bertil at ping pong. */
async function seedMatch(w: World): Promise<void> {
  const { error } = await serviceClient().from("competition_matches").insert({
    event_id: w.cast.event.id,
    competition_id: w.ping,
    winner_id: w.cast.guestA.id,
    loser_id: w.cast.guestB.id,
    reporter_id: w.cast.guestA.id,
  });
  expect(error).toBeNull();
}

describe("report_match", () => {
  it("stores a match won by the reporter, with no score", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;

    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
    });

    expect(result).toEqual({ answer: "reported", error: null });
    const { data } = await serviceClient()
      .from("competition_matches")
      .select("*")
      .eq("event_id", w.cast.event.id);
    expect(data).toMatchObject([
      {
        competition_id: w.ping,
        winner_id: guestA.id,
        loser_id: guestB.id,
        winner_score: null,
        loser_score: null,
        reporter_id: guestA.id,
      },
    ]);
  });

  it("stores a match lost by the reporter, with a score", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;

    const result = await report(w, guestA.client, {
      competition: w.darts,
      winner: guestB.id,
      loser: guestA.id,
      winnerScore: 501,
      loserScore: 0,
    });

    expect(result.answer).toBe("reported");
    const { data } = await serviceClient()
      .from("competition_matches")
      .select("winner_id, winner_score, loser_score, reporter_id")
      .eq("event_id", w.cast.event.id);
    expect(data).toEqual([
      {
        winner_id: guestB.id,
        winner_score: 501,
        loser_score: 0,
        reporter_id: guestA.id,
      },
    ]);
  });

  it("accepts the scores 0 and 999", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
      winnerScore: 999,
      loserScore: 0,
    });
    expect(result.answer).toBe("reported");
  });

  it("answers not_found to a non-member, and to the host and the TV", async () => {
    const w = await world();
    const { guestA, guestB, nonMember, otherHost, host, tv } = w.cast;
    for (const who of [nonMember, otherHost, host, tv]) {
      const result = await report(w, who.client, {
        winner: guestA.id,
        loser: guestB.id,
      });
      expect(result.answer).toBe("not_found");
    }
    expect(await matchCount(w)).toBe(0);
  });

  it("answers the same not_found for a wrong event as for a non-member", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    // Anna is a guest of the cast's event, not of the other one.
    const wrongEvent = await report(w, guestA.client, {
      eventId: w.cast.otherEvent.id,
      winner: guestA.id,
      loser: guestB.id,
    });
    const nonMember = await report(w, w.cast.nonMember.client, {
      winner: guestA.id,
      loser: guestB.id,
    });
    const unknownEvent = await report(w, guestA.client, {
      eventId: "00000000-0000-0000-0000-000000000000",
      winner: guestA.id,
      loser: guestB.id,
    });
    expect(wrongEvent).toEqual(nonMember);
    expect(unknownEvent).toEqual(nonMember);
    expect(nonMember.answer).toBe("not_found");
  });

  it("refuses a caller with no session", async () => {
    const w = await world();
    const { error } = await signedOutClient().rpc("report_match", {
      target_event_id: w.cast.event.id,
      target_competition_id: w.ping,
      winner: w.cast.guestA.id,
      loser: w.cast.guestB.id,
    });
    expect(error?.code).toBe("42501");
  });

  it("answers not_found to a guest who was removed", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const removed = await serviceClient().rpc("remove_guest", {
      target_event_id: w.cast.event.id,
      target_user_id: guestA.id,
    });
    expect(removed.data).toBe("removed");

    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
    });
    expect(result.answer).toBe("not_found");
  });

  it("answers not_a_participant when the reporter is neither player", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const third = await anonymousUser();
    await seedMember(w.cast.event.id, third.id, "guest", "Cecilia");

    const result = await report(w, third.client, {
      winner: guestA.id,
      loser: guestB.id,
    });

    expect(result.answer).toBe("not_a_participant");
    expect(await matchCount(w)).toBe(0);
  });

  it("answers same_player when winner and loser are the same", async () => {
    const w = await world();
    const { guestA } = w.cast;
    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestA.id,
    });
    expect(result.answer).toBe("same_player");
  });

  it("answers unknown_competition for a competition of another event", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const elsewhere = await seedCompetition(
      w.cast.otherEvent.id,
      0,
      "Elsewhere",
    );

    const result = await report(w, guestA.client, {
      competition: elsewhere,
      winner: guestA.id,
      loser: guestB.id,
    });

    expect(result.answer).toBe("unknown_competition");
    expect(await matchCount(w)).toBe(0);
  });

  it("answers unknown_competition for a competition that doesn't exist", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const result = await report(w, guestA.client, {
      competition: "00000000-0000-0000-0000-000000000000",
      winner: guestA.id,
      loser: guestB.id,
    });
    expect(result.answer).toBe("unknown_competition");
  });

  it("answers unknown_player when the opponent is the host, the TV or a stranger", async () => {
    const w = await world();
    const { guestA, host, tv, nonMember } = w.cast;
    for (const other of [host, tv, nonMember]) {
      const result = await report(w, guestA.client, {
        winner: guestA.id,
        loser: other.id,
      });
      expect(result.answer).toBe("unknown_player");
    }
    expect(await matchCount(w)).toBe(0);
  });

  it("answers unknown_player when the opponent was removed", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    await serviceClient().rpc("remove_guest", {
      target_event_id: w.cast.event.id,
      target_user_id: guestB.id,
    });
    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
    });
    expect(result.answer).toBe("unknown_player");
  });

  it.each([
    ["only the winner's score", 5, null],
    ["only the loser's score", null, 3],
    ["a negative score", 5, -1],
    ["a score over 999", 1000, 3],
  ])("answers invalid_score for %s", async (_name, winnerScore, loserScore) => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
      winnerScore,
      loserScore,
    });
    expect(result.answer).toBe("invalid_score");
    expect(await matchCount(w)).toBe(0);
  });

  it.each([
    ["the loser leads", 3, 5],
    ["the scores are equal", 4, 4],
  ])(
    "answers score_mismatch when %s",
    async (_name, winnerScore, loserScore) => {
      const w = await world();
      const { guestA, guestB } = w.cast;
      const result = await report(w, guestA.client, {
        winner: guestA.id,
        loser: guestB.id,
        winnerScore,
        loserScore,
      });
      expect(result.answer).toBe("score_mismatch");
      expect(await matchCount(w)).toBe(0);
    },
  );

  it("answers ended after the host ended the event", async () => {
    const w = await world();
    await setEventStatus(w.cast.event.id, "ended");
    const result = await report(w, w.cast.guestA.client, {
      winner: w.cast.guestA.id,
      loser: w.cast.guestB.id,
    });
    expect(result.answer).toBe("ended");
    expect(await matchCount(w)).toBe(0);
  });

  it("answers not_found for an expired event", async () => {
    const w = await world();
    await expireEvent(w.cast.event.id);
    const result = await report(w, w.cast.guestA.client, {
      winner: w.cast.guestA.id,
      loser: w.cast.guestB.id,
    });
    expect(result.answer).toBe("not_found");
  });

  it("answers disabled when Competitions is switched off", async () => {
    const w = await world(["quiz"]);
    const result = await report(w, w.cast.guestA.client, {
      winner: w.cast.guestA.id,
      loser: w.cast.guestB.id,
    });
    expect(result.answer).toBe("disabled");
    expect(await matchCount(w)).toBe(0);
  });

  it("answers rate_limited after 30 reports in an hour, and stores nothing", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    sql(
      `insert into private.rate_limits (user_id, action, count) ` +
        `values ('${guestA.id}', 'report_match', 30) ` +
        `on conflict (user_id, action) do update set count = 30, window_start = now()`,
    );

    const result = await report(w, guestA.client, {
      winner: guestA.id,
      loser: guestB.id,
    });

    expect(result.answer).toBe("rate_limited");
    expect(await matchCount(w)).toBe(0);
  });

  it("doesn't count refused reports against the limit", async () => {
    const w = await world();
    const { guestA } = w.cast;
    for (let i = 0; i < 35; i += 1) {
      const result = await report(w, guestA.client, {
        winner: guestA.id,
        loser: guestA.id,
      });
      expect(result.answer).toBe("same_player");
    }
    const ok = await report(w, guestA.client, {
      winner: guestA.id,
      loser: w.cast.guestB.id,
    });
    expect(ok.answer).toBe("reported");
  });
});

describe("reading and writing matches", () => {
  let w: World;
  const readers = ["host", "guestA", "guestB", "tv"] as const;
  const outsiders = ["nonMember", "otherHost"] as const;

  beforeAll(async () => {
    w = await world();
    await seedMatch(w);
  });

  async function read(who: User): Promise<number> {
    const { data, error } = await who.client
      .from("competition_matches")
      .select("id")
      .eq("event_id", w.cast.event.id);
    expect(error).toBeNull();
    return data?.length ?? 0;
  }

  it.each(readers)(
    "lets the %s read the matches of their event",
    async (role) => {
      expect(await read(w.cast[role])).toBe(1);
    },
  );

  it.each(outsiders)("shows the %s no match of the event", async (role) => {
    expect(await read(w.cast[role])).toBe(0);
  });

  it("shows a user with no session nothing", async () => {
    const { data } = await signedOutClient()
      .from("competition_matches")
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it.each([...readers, ...outsiders])(
    "stops the %s from writing a match directly",
    async (role) => {
      const { client, id } = w.cast[role];
      const insert = await client.from("competition_matches").insert({
        event_id: w.cast.event.id,
        competition_id: w.ping,
        winner_id: w.cast.guestA.id,
        loser_id: w.cast.guestB.id,
        reporter_id: w.cast.guestA.id,
      });
      const update = await client
        .from("competition_matches")
        .update({ winner_id: id })
        .eq("event_id", w.cast.event.id);
      const remove = await client
        .from("competition_matches")
        .delete()
        .eq("event_id", w.cast.event.id);
      expect(insert.error).not.toBeNull();
      expect(update.error).not.toBeNull();
      expect(remove.error).not.toBeNull();
      expect(await matchCount(w)).toBe(1);
    },
  );
});

describe("the rules of the table", () => {
  it("refuses rows that break them, whatever writes them", async () => {
    const w = await world();
    const { guestA, guestB, host } = w.cast;
    const base = {
      event_id: w.cast.event.id,
      competition_id: w.ping,
      winner_id: guestA.id,
      loser_id: guestB.id,
      reporter_id: guestA.id,
    };
    const bad: Array<Record<string, unknown>> = [
      { ...base, loser_id: guestA.id },
      { ...base, reporter_id: host.id },
      { ...base, winner_score: 5 },
      { ...base, loser_score: 5 },
      { ...base, winner_score: 3, loser_score: 5 },
      { ...base, winner_score: 1000, loser_score: 0 },
      { ...base, winner_score: 5, loser_score: -1 },
      {
        ...base,
        competition_id: await seedCompetition(w.cast.otherEvent.id, 0),
      },
      { ...base, winner_id: w.cast.nonMember.id },
    ];
    for (const row of bad) {
      const { error } = await serviceClient()
        .from("competition_matches")
        .insert(row as never);
      expect(error, JSON.stringify(row)).not.toBeNull();
    }
    expect(await matchCount(w)).toBe(0);
  });

  it("keeps a match when a guest is renamed", async () => {
    const w = await world();
    await seedMatch(w);
    const renamed = await w.cast.guestA.client
      .from("members")
      .update({ display_name: "Annika" })
      .eq("event_id", w.cast.event.id)
      .eq("user_id", w.cast.guestA.id)
      .select("display_name");
    expect(renamed.data).toEqual([{ display_name: "Annika" }]);
    expect(await matchCount(w)).toBe(1);
  });

  it("deletes the matches of a competition together with it", async () => {
    const w = await world();
    await seedMatch(w);
    const { error } = await serviceClient()
      .from("competitions")
      .delete()
      .eq("id", w.ping);
    expect(error).toBeNull();
    expect(await matchCount(w)).toBe(0);
  });
});

describe("remove_guest", () => {
  it("removes every match the guest played, won or lost, and no other", async () => {
    const w = await world();
    const { guestA, guestB } = w.cast;
    const third = await anonymousUser();
    await seedMember(w.cast.event.id, third.id, "guest", "Cecilia");
    const service = serviceClient();
    const insert = (winner: string, loser: string, reporter: string) =>
      service.from("competition_matches").insert({
        event_id: w.cast.event.id,
        competition_id: w.ping,
        winner_id: winner,
        loser_id: loser,
        reporter_id: reporter,
      });
    await insert(guestA.id, guestB.id, guestA.id); // Anna won
    await insert(guestB.id, guestA.id, guestB.id); // Anna lost, Bertil reported
    await insert(guestB.id, third.id, third.id); // not Anna's

    const removed = await service.rpc("remove_guest", {
      target_event_id: w.cast.event.id,
      target_user_id: guestA.id,
    });

    expect(removed.data).toBe("removed");
    expect(await matchCount(w)).toBe(1);
    const { data } = await service
      .from("competition_matches")
      .select("winner_id, loser_id")
      .eq("event_id", w.cast.event.id);
    expect(data).toEqual([{ winner_id: guestB.id, loser_id: third.id }]);
  });

  it("leaves the matches of another event alone", async () => {
    const w = await world();
    await seedMatch(w);
    const other = await world();
    await seedMatch(other);

    await serviceClient().rpc("remove_guest", {
      target_event_id: w.cast.event.id,
      target_user_id: w.cast.guestA.id,
    });

    expect(await matchCount(w)).toBe(0);
    expect(await matchCount(other)).toBe(1);
  });
});

describe("the function's grants", () => {
  it("keeps the report limit helper away from clients", () => {
    expect(
      sql(
        "select has_function_privilege('authenticated', " +
          "'private.match_report_limit()', 'execute')",
      ),
    ).toEqual(["f"]);
  });

  it("lets signed-in users call report_match and signed-out users not", () => {
    const signature =
      "public.report_match(uuid, uuid, uuid, uuid, integer, integer)";
    expect(
      sql(
        `select has_function_privilege('authenticated', '${signature}', 'execute')`,
      ),
    ).toEqual(["t"]);
    expect(
      sql(`select has_function_privilege('anon', '${signature}', 'execute')`),
    ).toEqual(["f"]);
  });
});
