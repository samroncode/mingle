// Winners and host messages spec (#206), ticket #210: the `notices` table and
// the send_notice and delete_notice functions. The functions are called with
// the service role, as host-actions does; every client role is checked for
// what it can read and what it can't write.
import { describe, expect, it } from "vitest";
import {
  seedCast,
  seedEvent,
  serviceClient,
  setEventStatus,
  sql,
} from "./helpers";
import type { Cast, User } from "./helpers";

async function send(eventId: string, text: string | null) {
  const { data, error } = await serviceClient().rpc("send_notice", {
    target_event_id: eventId,
    notice_text: text as string,
  });
  if (error) throw error;
  return data;
}

async function remove(eventId: string, id: string) {
  const { data, error } = await serviceClient().rpc("delete_notice", {
    target_event_id: eventId,
    notice_id: id,
  });
  if (error) throw error;
  return data;
}

/** Moves every notice of the event back in time, past the 5 second limit. */
function ageNotices(eventId: string, seconds = 10) {
  sql(
    `update public.notices set created_at = created_at - interval '${seconds} seconds' ` +
      `where event_id = '${eventId}'`,
  );
}

function versionOf(eventId: string): number {
  return Number(
    sql(`select notices_version from public.events where id = '${eventId}'`)[0],
  );
}

function noticeId(eventId: string): string {
  return (
    sql(`select id from public.notices where event_id = '${eventId}'`)[0] ?? ""
  );
}

async function readableBy(user: User, eventId: string): Promise<string[]> {
  const { data, error } = await user.client
    .from("notices")
    .select("text")
    .eq("event_id", eventId);
  if (error) throw error;
  return data.map((row) => row.text);
}

async function seededWithNotice(): Promise<Cast> {
  const cast = await seedCast();
  expect(await send(cast.event.id, "Dinner is served")).toBe("sent");
  return cast;
}

describe("reading notices", () => {
  it("lets the host, a guest and the TV read the notices of their event", async () => {
    const cast = await seededWithNotice();

    for (const user of [cast.host, cast.guestA, cast.tv]) {
      expect(await readableBy(user, cast.event.id)).toEqual([
        "Dinner is served",
      ]);
    }
  });

  it("keeps them from a non-member, another event's host and a signed-out browser", async () => {
    const cast = await seededWithNotice();

    expect(await readableBy(cast.nonMember, cast.event.id)).toEqual([]);
    expect(await readableBy(cast.otherHost, cast.event.id)).toEqual([]);
  });

  it("keeps them from a removed guest", async () => {
    const cast = await seededWithNotice();
    expect(await readableBy(cast.guestB, cast.event.id)).toHaveLength(1);

    sql(
      `update public.members set removed_at = now() ` +
        `where event_id = '${cast.event.id}' and user_id = '${cast.guestB.id}'`,
    );

    expect(await readableBy(cast.guestB, cast.event.id)).toEqual([]);
    expect(await readableBy(cast.guestA, cast.event.id)).toHaveLength(1);
  });

  it("keeps them once the event has expired", async () => {
    const cast = await seededWithNotice();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${cast.event.id}'`,
    );

    expect(await readableBy(cast.guestA, cast.event.id)).toEqual([]);
  });
});

describe("writing notices directly", () => {
  it("is refused for a guest, the TV, the host and a non-member", async () => {
    const cast = await seededWithNotice();
    const id = noticeId(cast.event.id);

    for (const user of [cast.guestA, cast.tv, cast.host, cast.nonMember]) {
      const insert = await user.client
        .from("notices")
        .insert({ event_id: cast.event.id, text: "Hello" });
      const update = await user.client
        .from("notices")
        .update({ text: "Changed" })
        .eq("id", id);
      const del = await user.client.from("notices").delete().eq("id", id);

      expect(insert.error).not.toBeNull();
      expect(update.error).not.toBeNull();
      expect(del.error).not.toBeNull();
    }
    expect(sql(`select text from public.notices where id = '${id}'`)).toEqual([
      "Dinner is served",
    ]);
    expect(versionOf(cast.event.id)).toBe(1);
  });

  it("can't call send_notice or delete_notice as a client", async () => {
    const cast = await seededWithNotice();

    for (const user of [cast.host, cast.guestA, cast.tv]) {
      const sent = await user.client.rpc("send_notice", {
        target_event_id: cast.event.id,
        notice_text: "Hello",
      });
      const deleted = await user.client.rpc("delete_notice", {
        target_event_id: cast.event.id,
        notice_id: noticeId(cast.event.id),
      });
      expect(sent.error).not.toBeNull();
      expect(deleted.error).not.toBeNull();
    }
    expect(await readableBy(cast.host, cast.event.id)).toEqual([
      "Dinner is served",
    ]);
  });

  it("can't set notices_version", async () => {
    const cast = await seedCast();

    const update = await cast.host.client
      .from("events")
      .update({ notices_version: 99 })
      .eq("id", cast.event.id);

    expect(update.error).not.toBeNull();
    expect(versionOf(cast.event.id)).toBe(0);
  });
});

describe("send_notice", () => {
  it("stores the trimmed text and raises notices_version", async () => {
    const cast = await seedCast();
    expect(versionOf(cast.event.id)).toBe(0);

    expect(await send(cast.event.id, "  Taxi leaves at 01:00 \n")).toBe("sent");

    expect(await readableBy(cast.guestA, cast.event.id)).toEqual([
      "Taxi leaves at 01:00",
    ]);
    expect(versionOf(cast.event.id)).toBe(1);
  });

  it("accepts 140 characters and refuses 141", async () => {
    const cast = await seedCast();

    expect(await send(cast.event.id, "x".repeat(141))).toBe("invalid");
    expect(await send(cast.event.id, "x".repeat(140))).toBe("sent");
    expect(
      sql(
        `select count(*) from public.notices where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["1"]);
    expect(versionOf(cast.event.id)).toBe(1);
  });

  it.each([
    ["empty", ""],
    ["spaces", "   "],
    ["whitespace", " \t\n "],
    ["null", null],
  ])("refuses text that is %s", async (_, text) => {
    const cast = await seedCast();

    expect(await send(cast.event.id, text)).toBe("invalid");
    expect(versionOf(cast.event.id)).toBe(0);
  });

  it("refuses a second notice within 5 seconds, and allows it after", async () => {
    const cast = await seedCast();
    expect(await send(cast.event.id, "One")).toBe("sent");

    expect(await send(cast.event.id, "Two")).toBe("too_soon");
    expect(versionOf(cast.event.id)).toBe(1);

    ageNotices(cast.event.id);
    expect(await send(cast.event.id, "Two")).toBe("sent");
    expect(versionOf(cast.event.id)).toBe(2);
  });

  it("refuses the 31st notice with too_many", async () => {
    const cast = await seedCast();
    for (let i = 1; i <= 30; i++) {
      ageNotices(cast.event.id);
      expect(await send(cast.event.id, `Notice ${i}`)).toBe("sent");
    }

    ageNotices(cast.event.id);
    expect(await send(cast.event.id, "Notice 31")).toBe("too_many");
    expect(
      sql(
        `select count(*) from public.notices where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["30"]);
  });

  it("counts the limits per event", async () => {
    const cast = await seedCast();
    expect(await send(cast.event.id, "One")).toBe("sent");

    expect(await send(cast.otherEvent.id, "One")).toBe("sent");
  });

  it("refuses an ended event", async () => {
    const cast = await seedCast();
    await setEventStatus(cast.event.id, "ended");

    expect(await send(cast.event.id, "Hello")).toBe("ended");
    expect(versionOf(cast.event.id)).toBe(0);
  });

  it("answers not_found for an unknown and an expired event", async () => {
    const expired = await seedEvent();
    sql(
      `update public.events set expires_at = now() - interval '1 second' ` +
        `where id = '${expired.id}'`,
    );

    expect(await send("00000000-0000-0000-0000-000000000000", "Hello")).toBe(
      "not_found",
    );
    expect(await send(expired.id, "Hello")).toBe("not_found");
  });
});

describe("delete_notice", () => {
  it("deletes the notice and raises notices_version", async () => {
    const cast = await seededWithNotice();

    expect(await remove(cast.event.id, noticeId(cast.event.id))).toBe(
      "deleted",
    );

    expect(await readableBy(cast.guestA, cast.event.id)).toEqual([]);
    expect(versionOf(cast.event.id)).toBe(2);
  });

  it("answers not_found for an unknown notice, changing nothing", async () => {
    const cast = await seededWithNotice();

    expect(
      await remove(cast.event.id, "00000000-0000-0000-0000-000000000000"),
    ).toBe("not_found");
    expect(versionOf(cast.event.id)).toBe(1);
  });

  it("answers not_found for a notice of another event", async () => {
    const cast = await seededWithNotice();
    const id = noticeId(cast.event.id);

    expect(await remove(cast.otherEvent.id, id)).toBe("not_found");

    expect(await readableBy(cast.guestA, cast.event.id)).toHaveLength(1);
    expect(versionOf(cast.event.id)).toBe(1);
    expect(versionOf(cast.otherEvent.id)).toBe(0);
  });

  it("answers not_found for an event that doesn't exist", async () => {
    expect(
      await remove(
        "00000000-0000-0000-0000-000000000000",
        "00000000-0000-0000-0000-000000000000",
      ),
    ).toBe("not_found");
  });
});

describe("deleting the event", () => {
  it("removes its notices", async () => {
    const cast = await seededWithNotice();

    sql(`delete from public.events where id = '${cast.event.id}'`);

    expect(
      sql(
        `select count(*) from public.notices where event_id = '${cast.event.id}'`,
      ),
    ).toEqual(["0"]);
  });
});
