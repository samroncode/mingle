// #21: the data layer for getting into an event, tested through its public
// functions against the local stack.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  anonymousUsers,
  expireEvent,
  seedCast,
  seedEvent,
  seedMember,
  setEventStatus,
  signedOutClient,
  type Client,
} from "./helpers";
import { ensureAnonymousSession } from "../../src/api/session";
import {
  getEventSnapshot,
  joinAsTv,
  joinEvent,
  renameGuest,
} from "../../src/api/events";
import type { Database } from "../../src/api/database.types";

/** A browser's storage that survives "reloads" within a test. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** A fresh client like the app's, with the given storage. */
function browserClient(storage: ReturnType<typeof memoryStorage>): Client {
  // The helpers' anon client has the URL and key; reuse them.
  const probe = signedOutClient() as unknown as {
    supabaseUrl: string;
    supabaseKey: string;
  };
  return createClient<Database>(probe.supabaseUrl, probe.supabaseKey, {
    auth: { storage, autoRefreshToken: false, persistSession: true },
  });
}

async function signedInBrowser(): Promise<Client> {
  const client = browserClient(memoryStorage());
  await ensureAnonymousSession(client);
  return client;
}

describe("ensureAnonymousSession", () => {
  it("signs in once and returns the same user on later calls and after a reload", async () => {
    const storage = memoryStorage();

    const first = await ensureAnonymousSession(browserClient(storage));
    const again = await ensureAnonymousSession(browserClient(storage));

    expect(first).not.toBe("");
    expect(again).toBe(first);
    const other = await ensureAnonymousSession(browserClient(memoryStorage()));
    expect(other).not.toBe(first);
  });
});

describe("joinEvent", () => {
  it("returns the event id for a valid code and name", async () => {
    const event = await seedEvent();
    const client = await signedInBrowser();

    expect(await joinEvent(event.code, "Anna", client)).toEqual({
      ok: true,
      value: event.id,
    });
  });

  it("returns not_found for an unknown code", async () => {
    const client = await signedInBrowser();

    expect(await joinEvent("ZZZZZZ", "Anna", client)).toEqual({
      ok: false,
      error: "not_found",
    });
  });

  it("returns ended for an ended event", async () => {
    const event = await seedEvent({ status: "ended" });
    const client = await signedInBrowser();

    expect(await joinEvent(event.code, "Anna", client)).toEqual({
      ok: false,
      error: "ended",
    });
  });

  it("returns invalid_name for a blank name", async () => {
    const event = await seedEvent();
    const client = await signedInBrowser();

    expect(await joinEvent(event.code, "   ", client)).toEqual({
      ok: false,
      error: "invalid_name",
    });
  });

  it("returns name_taken for a name already used in the event", async () => {
    const cast = await seedCast();
    const client = await signedInBrowser();

    expect(await joinEvent(cast.event.code, "anna", client)).toEqual({
      ok: false,
      error: "name_taken",
    });
  });

  it("returns rate_limited after too many unknown codes", async () => {
    const client = await signedInBrowser();
    for (let i = 0; i < 10; i++) await joinEvent("ZZZZZZ", "Anna", client);

    expect(await joinEvent("ZZZZZZ", "Anna", client)).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });
});

describe("joinAsTv", () => {
  it("returns the event id, and not_found / ended as typed errors", async () => {
    const event = await seedEvent();
    const ended = await seedEvent({ status: "ended" });
    const client = await signedInBrowser();

    expect(await joinAsTv(event.code, client)).toEqual({
      ok: true,
      value: event.id,
    });
    expect(await joinAsTv("ZZZZZZ", client)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await joinAsTv(ended.code, client)).toEqual({
      ok: false,
      error: "ended",
    });
  });
});

describe("getEventSnapshot", () => {
  it("returns the event and its members for a member", async () => {
    const cast = await seedCast();

    const result = await getEventSnapshot(cast.event.id, cast.guestA.client);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.event.id).toBe(cast.event.id);
    expect(
      result.value.members.map((m) => [m.role, m.display_name]).sort(),
    ).toEqual([
      ["guest", "Anna"],
      ["guest", "Bertil"],
      ["host", null],
      ["tv", null],
    ]);
  });

  it("returns not_found for a non-member, an unknown id and an expired event", async () => {
    const cast = await seedCast();
    const expired = await seedEvent();
    const [member] = await anonymousUsers(1);
    await seedMember(expired.id, member.id, "guest", "Cecilia");
    await expireEvent(expired.id);

    const notFound = { ok: false, error: "not_found" };
    expect(
      await getEventSnapshot(cast.event.id, cast.nonMember.client),
    ).toEqual(notFound);
    expect(
      await getEventSnapshot(
        "00000000-0000-0000-0000-000000000000",
        cast.host.client,
      ),
    ).toEqual(notFound);
    expect(await getEventSnapshot(expired.id, member.client)).toEqual(notFound);
  });

  it("reflects the current flow state", async () => {
    const cast = await seedCast();
    await setEventStatus(cast.event.id, "live");

    const result = await getEventSnapshot(cast.event.id, cast.tv.client);

    expect(result.ok && result.value.event.status).toBe("live");
  });
});

describe("renameGuest", () => {
  it("changes the guest's own display name", async () => {
    const cast = await seedCast();

    expect(
      await renameGuest(cast.event.id, "  Anneli ", cast.guestA.client),
    ).toEqual({ ok: true, value: "Anneli" });
    const snapshot = await getEventSnapshot(cast.event.id, cast.host.client);
    expect(
      snapshot.ok && snapshot.value.members.map((m) => m.display_name),
    ).toContain("Anneli");
  });

  it("returns name_taken for another guest's name, ignoring case", async () => {
    const cast = await seedCast();

    expect(
      await renameGuest(cast.event.id, "bertil", cast.guestA.client),
    ).toEqual({ ok: false, error: "name_taken" });
  });

  it("returns invalid_name for a blank or too long name", async () => {
    const cast = await seedCast();

    for (const name of ["   ", "x".repeat(31)]) {
      expect(
        await renameGuest(cast.event.id, name, cast.guestA.client),
      ).toEqual({ ok: false, error: "invalid_name" });
    }
  });

  it("returns not_found for someone who is not a guest of the event", async () => {
    const cast = await seedCast();

    for (const user of [cast.nonMember, cast.tv, cast.host]) {
      expect(await renameGuest(cast.event.id, "Nytt", user.client)).toEqual({
        ok: false,
        error: "not_found",
      });
    }
  });
});
