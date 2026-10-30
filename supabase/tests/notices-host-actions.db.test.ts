// Winners and host messages spec (#206), ticket #210: host-actions
// `send_notice` and `delete_notice`. Called over HTTP through
// `supabase functions serve`; the notices are read back as a guest.
import { describe, expect, it } from "vitest";
import { anonymousUser, anonymousUsers, sql, type User } from "./helpers";
import { callHostActions } from "./functions";
import { otherKey, unusedCode, type HostLink } from "./host-helpers";

type Host = HostLink & { user: User; eventId: string; guest: User };

async function createEvent(): Promise<Host> {
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
  const [guest] = await anonymousUsers(1);
  if (!guest) throw new Error("no guest");
  await guest.client.rpc("join_event", {
    code: link.code,
    display_name: "Anna",
  });
  return { ...link, user, eventId, guest };
}

function sendNotice(host: Host, text: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "send_notice", code: link.code, key: link.key, text },
    { user: host.user },
  );
}

function deleteNotice(host: Host, id: unknown, link: HostLink = host) {
  return callHostActions(
    { action: "delete_notice", code: link.code, key: link.key, id },
    { user: host.user },
  );
}

async function textsOf(host: Host): Promise<string[]> {
  const { data, error } = await host.guest.client
    .from("notices")
    .select("text")
    .eq("event_id", host.eventId);
  if (error) throw error;
  return data.map((row) => row.text);
}

function ageNotices(host: Host) {
  sql(
    `update public.notices set created_at = created_at - interval '10 seconds' ` +
      `where event_id = '${host.eventId}'`,
  );
}

describe("send_notice with the right key", () => {
  it("sends the trimmed text, answering {}", async () => {
    const host = await createEvent();

    const response = await sendNotice(host, "  Dinner is served ");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await textsOf(host)).toEqual(["Dinner is served"]);
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["141 characters", "x".repeat(141)],
    ["not a string", 5],
  ])("answers invalid_request for text that is %s", async (_, text) => {
    const host = await createEvent();

    const response = await sendNotice(host, text);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
    expect(await textsOf(host)).toEqual([]);
  });

  it("answers too_soon for a second notice within 5 seconds", async () => {
    const host = await createEvent();
    expect((await sendNotice(host, "One")).status).toBe(200);

    const response = await sendNotice(host, "Two");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({ error: "too_soon" });
  });

  it("answers too_many for the 31st notice", async () => {
    const host = await createEvent();
    sql(
      `insert into public.notices (event_id, text, created_at) ` +
        `select '${host.eventId}', 'Old ' || i, now() - interval '1 hour' ` +
        `from generate_series(1, 30) i`,
    );

    const response = await sendNotice(host, "One more");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "too_many" });
  });

  it("answers ended once the event has ended", async () => {
    const host = await createEvent();
    sql(
      `update public.events set status = 'ended' where id = '${host.eventId}'`,
    );

    const response = await sendNotice(host, "Hello");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "ended" });
  });
});

describe("delete_notice with the right key", () => {
  it("deletes the notice, answering {}", async () => {
    const host = await createEvent();
    await sendNotice(host, "Wrong time");
    const [id = ""] = sql(
      `select id from public.notices where event_id = '${host.eventId}'`,
    );

    const response = await deleteNotice(host, id);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({});
    expect(await textsOf(host)).toEqual([]);
  });

  it("answers not_found for an unknown notice", async () => {
    const host = await createEvent();

    const response = await deleteNotice(
      host,
      "00000000-0000-0000-0000-000000000000",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
  });

  it("answers not_found for another event's notice, and keeps it", async () => {
    const host = await createEvent();
    const other = await createEvent();
    await sendNotice(other, "Theirs");
    const [id = ""] = sql(
      `select id from public.notices where event_id = '${other.eventId}'`,
    );

    const response = await deleteNotice(host, id);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "not_found" });
    expect(await textsOf(other)).toEqual(["Theirs"]);
  });

  it("answers invalid_request for an id that isn't a uuid", async () => {
    const host = await createEvent();

    const response = await deleteNotice(host, "nope");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_request" });
  });
});

describe("without the right key", () => {
  it("answers a wrong key, an unknown code and another event's key alike", async () => {
    const host = await createEvent();
    const other = await createEvent();
    await sendNotice(host, "Mine");
    ageNotices(host);
    const [id = ""] = sql(
      `select id from public.notices where event_id = '${host.eventId}'`,
    );
    const links: HostLink[] = [
      { code: host.code, key: otherKey(host.key) },
      { code: unusedCode(), key: host.key },
      { code: host.code, key: other.key },
    ];

    const answers = [];
    for (const link of links) {
      answers.push(await sendNotice(host, "Intruder", link));
      answers.push(await deleteNotice(host, id, link));
    }

    for (const answer of answers) {
      expect(answer.status).toBe(answers[0]?.status);
      expect(answer.body).toEqual({ error: "not_authorized" });
    }
    expect(await textsOf(host)).toEqual(["Mine"]);
  });
});
