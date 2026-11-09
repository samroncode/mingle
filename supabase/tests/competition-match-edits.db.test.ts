// Competitions spec (#262), ticket #265: `edit_match` and `delete_match`.
// Only the service role (host-actions) may call them; a match of another
// event is never touched. The HTTP side is in competition-match-host-actions.
import { describe, expect, it } from "vitest";
import {
  seedCast,
  seedCompetition,
  serviceClient,
  setEventStatus,
  sql,
  type Cast,
} from "./helpers";

type World = { cast: Cast; ping: string };

async function world(modules: string[] = ["competitions"]): Promise<World> {
  const cast = await seedCast({ enabled_modules: modules });
  const ping = await seedCompetition(cast.event.id, 0, "Ping pong");
  // The other event has Competitions on too, so only the match is unknown.
  sql(
    `update public.events set enabled_modules = array['competitions'] ` +
      `where id = '${cast.otherEvent.id}'`,
  );
  return { cast, ping };
}

/** Anna (reporter) beat Bertil 21-15 at ping pong; returns the match id. */
async function seedMatch(w: World, eventId = w.cast.event.id): Promise<string> {
  const { data, error } = await serviceClient()
    .from("competition_matches")
    .insert({
      event_id: eventId,
      competition_id: w.ping,
      winner_id: w.cast.guestA.id,
      loser_id: w.cast.guestB.id,
      winner_score: 21,
      loser_score: 15,
      reporter_id: w.cast.guestA.id,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

type Edit = {
  winner?: string;
  winnerScore?: number | null;
  loserScore?: number | null;
  eventId?: string;
};

async function edit(w: World, matchId: string, e: Edit = {}) {
  const { data, error } = await serviceClient().rpc("edit_match", {
    target_event_id: e.eventId ?? w.cast.event.id,
    match_id: matchId,
    new_winner: e.winner ?? w.cast.guestA.id,
    // The generated types leave out null; the function takes it.
    new_winner_score: (e.winnerScore === undefined
      ? 21
      : e.winnerScore) as number,
    new_loser_score: (e.loserScore === undefined ? 15 : e.loserScore) as number,
  });
  expect(error).toBeNull();
  return data;
}

async function stored(matchId: string) {
  const { data } = await serviceClient()
    .from("competition_matches")
    .select("winner_id, loser_id, winner_score, loser_score, reporter_id")
    .eq("id", matchId);
  return data ?? [];
}

describe("edit_match", () => {
  it("changes the score and keeps the players and the reporter", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await edit(w, id, { winnerScore: 25, loserScore: 3 })).toBe(
      "edited",
    );

    expect(await stored(id)).toEqual([
      {
        winner_id: w.cast.guestA.id,
        loser_id: w.cast.guestB.id,
        winner_score: 25,
        loser_score: 3,
        reporter_id: w.cast.guestA.id,
      },
    ]);
  });

  it("swaps winner and loser when the other player is named", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await edit(w, id, { winner: w.cast.guestB.id })).toBe("edited");

    expect(await stored(id)).toMatchObject([
      { winner_id: w.cast.guestB.id, loser_id: w.cast.guestA.id },
    ]);
  });

  it("clears the score when none is given", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await edit(w, id, { winnerScore: null, loserScore: null })).toBe(
      "edited",
    );

    expect(await stored(id)).toMatchObject([
      { winner_score: null, loser_score: null },
    ]);
  });

  it("refuses a winner who didn't play the match", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await edit(w, id, { winner: w.cast.host.id })).toBe(
      "invalid_winner",
    );
    expect(await edit(w, id, { winner: w.cast.tv.id })).toBe("invalid_winner");
    expect(await stored(id)).toMatchObject([{ winner_score: 21 }]);
  });

  it("refuses scores that break the rules, changing nothing", async () => {
    const w = await world();
    const id = await seedMatch(w);
    const cases: Array<[Edit, string]> = [
      [{ winnerScore: 10, loserScore: null }, "invalid_score"],
      [{ winnerScore: null, loserScore: 10 }, "invalid_score"],
      [{ winnerScore: 1000, loserScore: 1 }, "invalid_score"],
      [{ winnerScore: 5, loserScore: -1 }, "invalid_score"],
      [{ winnerScore: 10, loserScore: 10 }, "score_mismatch"],
      [{ winnerScore: 3, loserScore: 9 }, "score_mismatch"],
    ];
    for (const [fields, answer] of cases) {
      expect(await edit(w, id, fields), JSON.stringify(fields)).toBe(answer);
    }
    expect(await stored(id)).toMatchObject([
      { winner_score: 21, loser_score: 15 },
    ]);
  });

  it("answers unknown for a missing match and one of another event", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await edit(w, "00000000-0000-4000-8000-000000000000")).toBe(
      "unknown",
    );
    // Asked for through another event, the match is not found.
    expect(await edit(w, id, { eventId: w.cast.otherEvent.id })).toBe(
      "unknown",
    );
    expect(await stored(id)).toMatchObject([{ winner_score: 21 }]);
  });

  it("answers not_found for an unknown or expired event", async () => {
    const w = await world();
    const id = await seedMatch(w);
    expect(
      await edit(w, id, { eventId: "00000000-0000-4000-8000-000000000000" }),
    ).toBe("not_found");
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${w.cast.event.id}'`,
    );
    expect(await edit(w, id)).toBe("not_found");
  });

  it("refuses after the evening ended and while Competitions is off", async () => {
    const off = await world(["quiz"]);
    expect(await edit(off, await seedMatch(off))).toBe("disabled");

    const ended = await world();
    const id = await seedMatch(ended);
    await setEventStatus(ended.cast.event.id, "ended");
    expect(await edit(ended, id, { winnerScore: 30, loserScore: 1 })).toBe(
      "ended",
    );
    expect(await stored(id)).toMatchObject([{ winner_score: 21 }]);
  });

  it("can't be called by anyone but the service role", async () => {
    const w = await world();
    const id = await seedMatch(w);
    for (const who of [
      w.cast.host,
      w.cast.guestA,
      w.cast.tv,
      w.cast.nonMember,
    ]) {
      const { error } = await who.client.rpc("edit_match", {
        target_event_id: w.cast.event.id,
        match_id: id,
        new_winner: w.cast.guestA.id,
        new_winner_score: 99,
        new_loser_score: 0,
      });
      expect(error).not.toBeNull();
    }
    expect(await stored(id)).toMatchObject([{ winner_score: 21 }]);
  });
});

describe("delete_match", () => {
  async function remove(w: World, matchId: string, eventId?: string) {
    const { data, error } = await serviceClient().rpc("delete_match", {
      target_event_id: eventId ?? w.cast.event.id,
      match_id: matchId,
    });
    expect(error).toBeNull();
    return data;
  }

  it("deletes the match", async () => {
    const w = await world();
    const id = await seedMatch(w);
    const kept = await seedMatch(w);

    expect(await remove(w, id)).toBe("deleted");

    expect(await stored(id)).toEqual([]);
    expect(await stored(kept)).toHaveLength(1);
  });

  it("answers unknown for a missing match and one of another event", async () => {
    const w = await world();
    const id = await seedMatch(w);

    expect(await remove(w, "00000000-0000-4000-8000-000000000000")).toBe(
      "unknown",
    );
    expect(await remove(w, id, w.cast.otherEvent.id)).toBe("unknown");
    expect(await stored(id)).toHaveLength(1);
  });

  it("refuses after the evening ended and while Competitions is off", async () => {
    const off = await world(["quiz"]);
    const offId = await seedMatch(off);
    expect(await remove(off, offId)).toBe("disabled");
    expect(await stored(offId)).toHaveLength(1);

    const ended = await world();
    const id = await seedMatch(ended);
    await setEventStatus(ended.cast.event.id, "ended");
    expect(await remove(ended, id)).toBe("ended");
    expect(await stored(id)).toHaveLength(1);
  });

  it("answers not_found for an unknown event", async () => {
    const w = await world();
    const id = await seedMatch(w);
    expect(await remove(w, id, "00000000-0000-4000-8000-000000000000")).toBe(
      "not_found",
    );
  });

  it("can't be called by anyone but the service role", async () => {
    const w = await world();
    const id = await seedMatch(w);
    for (const who of [
      w.cast.host,
      w.cast.guestA,
      w.cast.tv,
      w.cast.nonMember,
    ]) {
      const { error } = await who.client.rpc("delete_match", {
        target_event_id: w.cast.event.id,
        match_id: id,
      });
      expect(error).not.toBeNull();
    }
    expect(await stored(id)).toHaveLength(1);
  });
});
