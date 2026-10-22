// #23: live updates. `subscribeToEvent` is tested through its public function
// against the local stack; host moves go through host-actions over HTTP.
import { afterEach, describe, expect, it, vi } from "vitest";
import { anonymousUser, type User } from "./helpers";
import { callHostActions } from "./functions";
import { subscribeToEvent } from "../../src/api/realtime";
import { joinEvent, type EventSnapshot } from "../../src/api/events";
import type { Result, SnapshotErrorCode } from "../../src/api/errors";

type Snapshot = Result<EventSnapshot, SnapshotErrorCode>;
type Host = { code: string; key: string; user: User };

const stops: (() => void)[] = [];
afterEach(() => {
  while (stops.length) stops.pop()?.();
});

async function createEvent(): Promise<Host> {
  const user = await anonymousUser();
  const response = await callHostActions(
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "awards", "hottakes"],
      party: {},
      // The quiz can only start with questions.
      quiz: [{ text: "Ok?", options: ["a", "b", "c", "d"], correct: 0 }],
    },
    { user },
  );
  expect(response.status).toBe(200);
  return { ...(response.body as { code: string; key: string }), user };
}

async function startQuiz(host: Host): Promise<void> {
  const response = await callHostActions(
    {
      action: "set_flow",
      code: host.code,
      key: host.key,
      move: { type: "start_module", module: "quiz" },
    },
    { user: host.user },
  );
  expect(response.status).toBe(200);
}

/** Joins the host's event as a new guest; returns the guest and event id. */
async function guestOf(host: Host, name = "Anna") {
  const guest = await anonymousUser();
  const joined = await joinEvent(host.code, name, guest.client);
  if (!joined.ok) throw new Error(joined.error);
  return { guest, eventId: joined.value };
}

/** Subscribes and records every snapshot the client is handed. */
function watch(eventId: string, user: User) {
  const seen: Snapshot[] = [];
  const stop = subscribeToEvent(eventId, (s) => seen.push(s), user.client);
  stops.push(stop);
  return { seen, stop };
}

function currentModule(seen: Snapshot[]): string | null | undefined {
  const s = seen.at(-1);
  return s?.ok ? s.value.event.current_module : undefined;
}

function guestNames(seen: Snapshot[]): (string | null)[] | undefined {
  const s = seen.at(-1);
  if (!s?.ok) return undefined;
  return s.value.members
    .filter((m) => m.role === "guest")
    .map((m) => m.display_name)
    .sort();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits for the first snapshot and then for a quiet second. Changes made just
 * before subscribing can still arrive as signals right after, each with its
 * own refetch. Returns how many snapshots there were by then.
 */
async function settled(seen: Snapshot[]): Promise<number> {
  await expect.poll(() => seen.length).toBeGreaterThan(0);
  let count = -1;
  while (count !== seen.length) {
    count = seen.length;
    await sleep(1000);
  }
  return count;
}

/** A browser tab's document whose visibility the test controls. */
function fakeDocument() {
  const tab = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  });
  let listeners = 0;
  const add = tab.addEventListener.bind(tab);
  const remove = tab.removeEventListener.bind(tab);
  tab.addEventListener = (...args: Parameters<typeof add>) => {
    listeners += 1;
    add(...args);
  };
  tab.removeEventListener = (...args: Parameters<typeof remove>) => {
    listeners -= 1;
    remove(...args);
  };
  vi.stubGlobal("document", tab);
  return {
    listeners: () => listeners,
    show(state: DocumentVisibilityState) {
      tab.visibilityState = state;
      tab.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

describe("subscribeToEvent", { timeout: 30_000 }, () => {
  it("hands a subscribed guest the new flow after the host starts an activity", async () => {
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const { seen } = watch(eventId, guest);
    await expect.poll(() => seen.at(-1)?.ok).toBe(true);
    expect(currentModule(seen)).toBeNull();

    await startQuiz(host);

    await expect
      .poll(() => currentModule(seen), { timeout: 10_000 })
      .toBe("quiz");
  });

  it("hands a subscribed guest the new member list when someone joins", async () => {
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host, "Anna");
    const { seen } = watch(eventId, guest);
    await expect.poll(() => seen.at(-1)?.ok).toBe(true);

    await guestOf(host, "Bertil");

    await expect
      .poll(() => guestNames(seen), { timeout: 10_000 })
      .toEqual(["Anna", "Bertil"]);
  });

  it("catches up through a refetch on its own after the connection drops", async () => {
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const { seen } = watch(eventId, guest);
    await expect.poll(() => seen.at(-1)?.ok).toBe(true);

    await guest.client.realtime.disconnect();
    await startQuiz(host);
    // The change happened while this client was offline.
    expect(guest.client.realtime.isConnected()).toBe(false);

    await expect
      .poll(() => currentModule(seen), { timeout: 15_000 })
      .toBe("quiz");
  });

  it("refetches when the tab becomes visible again, not when it's hidden", async () => {
    const tab = fakeDocument();
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const { seen } = watch(eventId, guest);
    const before = await settled(seen);

    tab.show("hidden");
    await sleep(500);
    expect(seen).toHaveLength(before);

    tab.show("visible");
    await expect.poll(() => seen.length).toBe(before + 1);
    expect(seen.at(-1)?.ok).toBe(true);
  });

  it("stops handing out snapshots and listening once unsubscribed", async () => {
    const tab = fakeDocument();
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const { seen, stop } = watch(eventId, guest);
    const before = await settled(seen);

    stop();
    await startQuiz(host);
    await guestOf(host, "Bertil");
    tab.show("visible");
    await sleep(2000);

    expect(seen).toHaveLength(before);
    expect(guest.client.getChannels()).toHaveLength(0);
    expect(tab.listeners()).toBe(0);
  });

  it("cancels a pending retry once unsubscribed", async () => {
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const { seen, stop } = watch(eventId, guest);
    const before = await settled(seen);

    await guest.client.realtime.disconnect();
    stop();
    await sleep(2500);

    expect(seen).toHaveLength(before);
    expect(guest.client.getChannels()).toHaveLength(0);
  });

  it("hands a non-member nothing but not_found, even when the event changes", async () => {
    const host = await createEvent();
    const { guest, eventId } = await guestOf(host);
    const outsider = await anonymousUser();
    const member = watch(eventId, guest);
    const nonMember = watch(eventId, outsider);
    await expect.poll(() => member.seen.at(-1)?.ok).toBe(true);
    await expect.poll(() => nonMember.seen.length).toBe(1);

    await startQuiz(host);
    // Once the member has heard of the change, the outsider would have too.
    await expect
      .poll(() => currentModule(member.seen), { timeout: 10_000 })
      .toBe("quiz");
    await sleep(1000);

    expect(nonMember.seen).toEqual([{ ok: false, error: "not_found" }]);
  });
});
