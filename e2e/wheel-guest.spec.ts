import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";
const me = "u1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

interface Entry {
  id: string;
  kind: "guest" | "custom";
  member_id: string | null;
  label: string | null;
  state: "on" | "off";
  position: number;
}

interface Spin {
  id: string;
  number: number;
  entry_id: string | null;
  label: string;
  /** Seconds before the page loads that the server recorded the spin. */
  agoSeconds: number;
}

const guestEntry = (id: string, member: string, state: "on" | "off" = "on") =>
  ({
    id,
    kind: "guest",
    member_id: member,
    label: null,
    state,
    position: 0,
  }) satisfies Entry;

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Fakes an event with the wheel running, as the guest "Anna" (u1) sees it. */
async function fakeWheel(
  page: Page,
  world: { entries: Entry[]; spins: Spin[] },
) {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, [
      {
        ...eventRow({
          code,
          enabled_modules: ["wheel"],
          current_module: "wheel",
          status: "live",
        }),
        members: [
          memberRow({ user_id: me, display_name: "Anna" }),
          memberRow({ user_id: bertil, display_name: "Bertil" }),
          memberRow({ user_id: "t1", role: "tv" }),
        ],
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/wheel_entries*`, (route) =>
    json(route, world.entries),
  );
  const loadedAt = Date.now();
  await page.route(`${supabase}/rest/v1/wheel_spins*`, (route) =>
    json(
      route,
      world.spins.map((spin) => ({
        id: spin.id,
        number: spin.number,
        entry_id: spin.entry_id,
        label: spin.label,
        spun_at: new Date(loadedAt - spin.agoSeconds * 1000).toISOString(),
      })),
    ),
  );
}

test.use({ viewport: { width: 390, height: 844 } });

test("a spin for the guest's own entry says so, but only after the TV has landed", async ({
  page,
}) => {
  await fakeWheel(page, {
    // The entry was taken off in the same step as the spin.
    entries: [guestEntry("e1", me, "off"), guestEntry("e2", bertil)],
    spins: [
      { id: "s1", number: 1, entry_id: "e1", label: "Anna", agoSeconds: 2 },
    ],
  });
  await page.goto(`/p/${code}`);

  await expect(page.getByTestId("wheel-spinning")).toBeVisible();
  await expect(page.getByTestId("wheel-result")).toHaveCount(0);

  await expect(page.getByTestId("wheel-its-you")).toHaveText("It's you!", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("wheel-result")).toContainText("Anna");
  await expect(page.getByTestId("wheel-spinning")).toHaveCount(0);
  await expect(page.getByTestId("wheel-status")).toHaveCount(0);
});

test("a spin for someone else names them without the highlight", async ({
  page,
}) => {
  await fakeWheel(page, {
    entries: [guestEntry("e1", me), guestEntry("e2", bertil)],
    spins: [
      { id: "s1", number: 1, entry_id: "e2", label: "Bertil", agoSeconds: 2 },
    ],
  });
  await page.goto(`/p/${code}`);

  await expect(page.getByTestId("wheel-result")).toHaveCount(0);
  await expect(page.getByTestId("wheel-result")).toContainText("Bertil", {
    timeout: 10_000,
  });
  await expect(page.getByTestId("wheel-its-you")).toHaveCount(0);
  await expect(page.getByTestId("wheel-status")).toContainText(
    "Watch the TV for the next spin.",
  );
});

test("a late load shows the latest result at once and the last five draws", async ({
  page,
}) => {
  const spins: Spin[] = [7, 6, 5, 4, 3, 2, 1].map((number) => ({
    id: `s${number}`,
    number,
    entry_id: "e2",
    label: number === 7 ? "Bertil" : `Draw ${number}`,
    agoSeconds: 600 - number,
  }));
  await fakeWheel(page, {
    entries: [guestEntry("e1", me), guestEntry("e2", bertil)],
    spins,
  });
  await page.goto(`/p/${code}`);

  await expect(page.getByTestId("wheel-result")).toContainText("Bertil");
  await expect(page.getByTestId("wheel-spinning")).toHaveCount(0);
  await expect(
    page.getByTestId("wheel-recent").getByRole("listitem"),
  ).toHaveCount(5);
});

test("a guest who is not on the wheel is told so", async ({ page }) => {
  await fakeWheel(page, {
    entries: [guestEntry("e2", bertil), guestEntry("e3", "other")],
    spins: [],
  });
  await page.goto(`/p/${code}`);
  await expect(page.getByTestId("wheel-status")).toHaveText(
    "You're not on the wheel this time.",
  );
});

test("a guest on a wheel with one entry waits for the host", async ({
  page,
}) => {
  await fakeWheel(page, { entries: [guestEntry("e1", me)], spins: [] });
  await page.goto(`/p/${code}`);
  await expect(page.getByTestId("wheel-status")).toHaveText(
    "Waiting for the host",
  );
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the highlight shows without confetti falling", async ({ page }) => {
    await fakeWheel(page, {
      entries: [guestEntry("e1", me), guestEntry("e2", bertil)],
      spins: [
        { id: "s1", number: 1, entry_id: "e1", label: "Anna", agoSeconds: 60 },
      ],
    });
    await page.goto(`/p/${code}`);
    await expect(page.getByTestId("wheel-its-you")).toBeVisible();
    const piece = page.getByTestId("confetti").locator("span").first();
    // Reduced motion turns the confetti level to 0: the pieces stay invisible.
    await expect(piece).toHaveCSS("opacity", "0");
  });
});
