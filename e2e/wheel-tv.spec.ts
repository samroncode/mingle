import { expect, test, type Page, type Route } from "@playwright/test";
import { wedgeUnderPointer } from "../src/lib/wheel/geometry.ts";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeSupabase, fakeTv, supabase } from "./fake-supabase.ts";

const code = "ABC234";
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";
const cecilia = "00000000-0000-4000-8000-0000000000c3";

const members = [
  memberRow({ user_id: anna, display_name: "Anna" }),
  memberRow({ user_id: bertil, display_name: "Bertil" }),
  memberRow({ user_id: cecilia, display_name: "Cecilia" }),
  memberRow({ user_id: "t1", role: "tv" }),
];

interface Entry {
  id: string;
  kind: "guest" | "custom";
  member_id: string | null;
  label: string | null;
  state: "on" | "off";
}
interface Spin {
  id: string;
  number: number;
  entry_id: string | null;
  label: string;
  spun_at: string;
}

const guest = (id: string, member: string): Entry => ({
  id,
  kind: "guest",
  member_id: member,
  label: null,
  state: "on",
});
const own = (id: string, label: string): Entry => ({
  id,
  kind: "custom",
  member_id: null,
  label,
  state: "on",
});

const allEntries = [
  guest("e1", anna),
  guest("e2", bertil),
  guest("e3", cecilia),
  own("e4", "Take a shot"),
];

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** What the test changes while the TV is open. */
interface Wheel {
  entries: Entry[];
  spins: Spin[];
}

/** Fakes the wheel reads, newest spin first; the test changes `wheel`. */
async function fakeWheel(page: Page, wheel: Wheel) {
  await page.route(`${supabase}/rest/v1/wheel_entries*`, (route) => {
    if (route.request().method() === "OPTIONS") return json(route, 200, {});
    return json(
      route,
      200,
      wheel.entries.map((e, position) => ({ ...e, position })),
    );
  });
  await page.route(`${supabase}/rest/v1/wheel_spins*`, (route) => {
    if (route.request().method() === "OPTIONS") return json(route, 200, {});
    const latest = wheel.spins.at(-1);
    const single = route
      .request()
      .headers()
      ["accept"]?.includes("pgrst.object");
    if (single) {
      return latest
        ? json(route, 200, latest)
        : json(route, 406, { code: "PGRST116", message: "no rows" });
    }
    return json(route, 200, [...wheel.spins].reverse());
  });
}

/**
 * Opens the realtime socket the way `fakeRealtime` does and keeps it, so a test
 * can announce a change on the spins channel. Registered after `fakeTv`, so it
 * is the one that answers.
 */
async function fakeSpinSignal(page: Page) {
  let announce: (table: "wheel_spins" | "wheel_entries") => void = () => {};
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
    const joined: Array<{ joinRef: string | null; topic: string }> = [];
    ws.onMessage((raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw)) as [
        string | null,
        string,
        string,
        string,
        { config?: { postgres_changes?: object[] } } | undefined,
      ];
      if (event === "heartbeat") {
        ws.send(
          JSON.stringify([
            null,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ]),
        );
      } else if (event === "phx_join") {
        joined.push({ joinRef, topic });
        const confirmed = (payload?.config?.postgres_changes ?? []).map(
          (filter, id) => ({ ...filter, id: id + 1 }),
        );
        ws.send(
          JSON.stringify([
            joinRef,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: { postgres_changes: confirmed } },
          ]),
        );
      }
    });
    announce = (table) => {
      // A channel that was left and joined again (a remount) is the newest.
      const channel = joined.findLast((j) =>
        j.topic.includes(table === "wheel_spins" ? "wheel-spins:" : "wheel:"),
      );
      if (!channel) throw new Error("The spins channel was not joined");
      ws.send(
        JSON.stringify([
          channel.joinRef,
          null,
          channel.topic,
          "postgres_changes",
          {
            ids: [1], // The client ignores an id of 0.
            data: {
              schema: "public",
              table,
              commit_timestamp: new Date().toISOString(),
              type: "INSERT",
              record: {},
              columns: [],
              errors: null,
            },
          },
        ]),
      );
    };
  });
  return (table: "wheel_spins" | "wheel_entries" = "wheel_spins") =>
    announce(table);
}

async function openTv(
  page: Page,
  wheel: Wheel,
  { running = true }: { running?: boolean } = {},
) {
  await fakeSupabase(page, []);
  await fakeTv(page, {
    snapshot: {
      ...eventRow({
        code,
        enabled_modules: ["wheel"],
        status: "live",
        current_module: running ? "wheel" : null,
      }),
      members,
    },
  });
  await fakeWheel(page, wheel);
  const signal = await fakeSpinSignal(page);
  await page.goto(`/tv/${code}`);
  return signal;
}

const spinOf = (number: number, entry: Entry, secondsAgo = 0): Spin => ({
  id: `s${number}`,
  number,
  entry_id: entry.id,
  label: entry.label ?? "Bertil",
  spun_at: new Date(Date.now() - secondsAgo * 1000).toISOString(),
});

test.describe("the wheel on the TV", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("a spin turns the wheel to the winner, who shows when it stops", async ({
    page,
  }) => {
    const wheel: Wheel = { entries: allEntries, spins: [] };
    const signal = await openTv(page, wheel);

    await expect(page.getByTestId("wheel-svg")).toBeVisible();
    await expect(page.getByTestId("wheel-disc").locator("text")).toHaveText([
      "Anna",
      "Bertil",
      "Cecilia",
      "Take a shot",
    ]);
    await page.screenshot({ path: "test-results/wheel-tv-idle.png" });

    wheel.spins.push(spinOf(1, allEntries[1]));
    signal();

    await expect(page.getByText("Spinning…")).toBeVisible();
    await expect(page.getByTestId("wheel-tv-winner")).toBeHidden();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: "test-results/wheel-tv-spinning.png" });

    await expect(page.getByTestId("wheel-tv-winner")).toHaveText("Bertil", {
      timeout: 10_000,
    });
    await expect(page.getByText("Draw 1")).toBeVisible();
    // The pointer rests inside the winner's wedge (Bertil is the second).
    const rotation = Number(
      await page.getByTestId("wheel-disc").getAttribute("data-rotation"),
    );
    expect(rotation).toBeGreaterThanOrEqual(5 * 360);
    expect(wedgeUnderPointer(4, rotation)).toBe(1);
    await page.screenshot({ path: "test-results/wheel-tv-result.png" });
  });

  test("a drawn entry taken off in the same step stays until the wheel stops", async ({
    page,
  }) => {
    const wheel: Wheel = { entries: allEntries, spins: [] };
    const signal = await openTv(page, wheel);
    await expect(page.getByTestId("wheel-svg")).toBeVisible();

    wheel.spins.push(spinOf(1, allEntries[1]));
    wheel.entries = allEntries.map((e) =>
      e.id === "e2" ? { ...e, state: "off" as const } : e,
    );
    signal();
    signal("wheel_entries");

    await expect(page.getByText("Spinning…")).toBeVisible();
    await expect(page.getByTestId("wheel-disc").locator("text")).toHaveCount(4);
    await expect(page.getByTestId("wheel-tv-winner")).toHaveText("Bertil", {
      timeout: 10_000,
    });
    // After the celebration the wheel follows the entries again.
    await expect(page.getByTestId("wheel-disc").locator("text")).toHaveText(
      ["Anna", "Cecilia", "Take a shot"],
      { timeout: 15_000 },
    );
  });

  test("a viewer who loads later sees the result without a spin", async ({
    page,
  }) => {
    const wheel: Wheel = {
      entries: allEntries,
      spins: [spinOf(3, allEntries[1], 120)],
    };
    await openTv(page, wheel);

    await expect(page.getByTestId("wheel-tv-winner")).toHaveText("Bertil");
    await expect(page.getByText("Spinning…")).toBeHidden();
    const rotation = Number(
      await page.getByTestId("wheel-disc").getAttribute("data-rotation"),
    );
    expect(wedgeUnderPointer(4, rotation)).toBe(1);
  });

  test("reduced motion jumps straight to the result", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const wheel: Wheel = { entries: allEntries, spins: [] };
    const signal = await openTv(page, wheel);
    await expect(page.getByTestId("wheel-svg")).toBeVisible();

    wheel.spins.push(spinOf(1, allEntries[3]));
    signal();

    await expect(page.getByTestId("wheel-tv-winner")).toHaveText(
      "Take a shot",
      { timeout: 2000 },
    );
    await expect(page.getByText("Spinning…")).toBeHidden();
  });

  test("fewer than two entries gives a calm message instead of a wheel", async ({
    page,
  }) => {
    await openTv(page, { entries: [allEntries[0]], spins: [] });

    await expect(page.getByTestId("wheel-tv-waiting")).toHaveText(
      "Waiting for the host to add entries",
    );
    await expect(page.getByTestId("wheel-svg")).toBeHidden();
  });

  test("the party screen returns when the wheel is not running", async ({
    page,
  }) => {
    await openTv(page, { entries: allEntries, spins: [] }, { running: false });

    await expect(page.getByTestId("tv-code")).toHaveText(code);
    await expect(page.getByTestId("wheel-tv")).toBeHidden();
  });
});
