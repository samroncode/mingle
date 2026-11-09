import { expect, test } from "@playwright/test";
import { eventRow, memberRow, type EventRow } from "./fake-rows.ts";
import {
  fakeSupabase,
  fakeTv,
  recordRequestUrls,
  supabase,
} from "./fake-supabase.ts";

test.use({ viewport: { width: 1920, height: 1080 } });

const code = "ABC234";

function member(user: string, role: string, name: string | null) {
  return memberRow({ user_id: user, role, display_name: name });
}

function snapshot(overrides: Partial<EventRow> = {}) {
  return {
    ...eventRow({
      id: "e1",
      code,
      party: { welcome: "Welcome to my place!" },
      ...overrides,
    }),
    members: [
      member("t", "tv", null),
      member("g1", "guest", "Anna"),
      member("g2", "guest", "Bo"),
    ],
  };
}

test("the TV joins and shows the code, the join address and the welcome text", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  const joined = await fakeTv(page, { snapshot: snapshot() });

  await page.goto(`/tv/${code}`);

  await expect(page.getByTestId("tv-code")).toHaveText(code);
  await expect(page.getByTestId("welcome-text")).toHaveText(
    "Welcome to my place!",
  );
  const origin = new URL(page.url()).origin;
  await expect(page.getByTestId("join-address")).toHaveText(
    `${origin}/p/${code}`,
  );
  await expect(page.getByTestId("guest-count")).toHaveText(
    "2 guests have joined",
  );
  await expect(
    page.getByRole("img", { name: "QR code to join the party" }),
  ).toBeVisible();
  // Dev StrictMode may join twice; joining as the TV is idempotent.
  expect(joined.length).toBeGreaterThan(0);
  expect(new Set(joined)).toEqual(new Set([code]));
});

test.describe("without a chosen language", () => {
  // No stored choice, so the event's language decides.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the TV starts in the event's language", async ({ page }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, { snapshot: snapshot({ language: "sv" }) });
    await page.goto(`/tv/${code}`);
    await expect(page.getByTestId("guest-count")).toHaveText(
      "2 gäster har gått med",
    );
  });
});

test("an ended event shows a thank-you", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakeTv(page, { snapshot: snapshot({ status: "ended" }) });
  await page.goto(`/tv/${code}`);
  await expect(page.getByText("Thank you for coming!")).toBeVisible();
});

test("a TV that opens an ended event for the first time shows the thank-you", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeTv(page, {
    join: { event_id: null, error: "ended" },
    snapshot: null,
  });
  await page.goto(`/tv/${code}`);
  await expect(page.getByText("Thank you for coming!")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an unknown code shows a clear error", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakeTv(page, {
    join: { event_id: null, error: "not_found" },
    snapshot: null,
  });
  await page.goto(`/tv/${code}`);
  await expect(page.getByRole("alert")).toContainText("couldn't find an event");
  await page.getByRole("link", { name: "Go to the start page" }).click();
  await expect(page).toHaveURL("/");
});

test("the TV shows no money and reads none, even when costs are on", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeTv(page, { snapshot: snapshot({ costs_version: 3 }) });
  const urls = recordRequestUrls(page);

  await page.goto(`/tv/${code}`);
  await expect(page.getByTestId("tv-code")).toHaveText(code);

  await expect(page.getByText(/swish|\bkr\b/i)).toHaveCount(0);
  expect(
    urls.filter((url) => url.startsWith(supabase) && /cost|my_bill/.test(url)),
  ).toEqual([]);
});

test("the TV uses the niche's theme, and the day theme in a bright room", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeTv(page, { snapshot: snapshot({ niche: "team" }) });
  await page.goto(`/tv/${code}`);
  await expect(page.locator("[data-niche]")).toHaveAttribute(
    "data-theme",
    "lounge",
  );
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-before.png` });
  }

  await fakeTv(page, {
    snapshot: snapshot({ niche: "team", bright_room: true }),
  });
  await page.goto(`/tv/${code}`);
  await expect(page.locator("[data-niche]")).toHaveAttribute(
    "data-theme",
    "day",
  );
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-bright.png` });
  }
});

test("the TV congratulates a winner that is added, but not the ones already there", async ({
  page,
}) => {
  const anna = { title: "Dart tournament", name: "Anna" };
  const bo = { title: "Ping pong", name: "Bo" };
  await fakeSupabase(page, []);
  let current = snapshot({ party: { winners: [anna] } });
  await fakeTv(page, {
    get snapshot() {
      return current;
    },
  });

  await page.goto(`/tv/${code}`);
  await expect(page.getByTestId("tv-code")).toHaveText(code);
  await expect(page.getByTestId("winner-congrats")).toHaveCount(0);

  current = snapshot({ party: { winners: [anna, bo] } });
  await page.evaluate('document.dispatchEvent(new Event("visibilitychange"))');

  const popup = page.getByTestId("winner-congrats");
  await expect(popup).toContainText("Congratulations, Bo!");
  await expect(popup).toContainText("Ping pong");
  await page.screenshot({ path: test.info().outputPath("tv-congrats.png") });
  await expect(popup).toHaveCount(0, { timeout: 6000 });
});

const mixedSchedule = [
  { time: "19:00", title: "Dinner" },
  { title: "Darts" },
  { title: "Ping pong" },
];

test("the TV schedule lines up untimed lines with a marker, and drops the time column when none has a time", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeTv(page, {
    snapshot: {
      ...snapshot({ party: { schedule: mixedSchedule } }),
      members: [],
    },
  });
  await page.goto(`/tv/${code}`);
  const items = page
    .locator("li")
    .filter({ hasText: /Dinner|Darts|Ping pong/ });
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("19:00");
  await expect(items.nth(1).locator("span[aria-hidden]")).toHaveCount(1);
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-mixed.png` });
  }

  await fakeTv(page, {
    snapshot: {
      ...snapshot({
        party: { schedule: [{ title: "Darts" }, { title: "Ping pong" }] },
      }),
      members: [],
    },
  });
  await page.goto(`/tv/${code}`);
  await expect(page.getByText("Darts")).toBeVisible();
  await expect(
    page.locator("li").filter({ hasText: "Darts" }).locator("span"),
  ).toHaveCount(1);
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-untimed.png` });
  }
});

test("the TV stacks menu and schedule lines and switches part by key or click", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeTv(page, {
    snapshot: {
      ...snapshot({
        party: {
          menu: ["Tacos", "Nachos", "Churros"],
          schedule: mixedSchedule,
        },
      }),
      members: [],
    },
  });
  await page.goto(`/tv/${code}`);
  const dinner = page.getByRole("listitem").filter({ hasText: "Tacos" });
  await expect(dinner).toBeVisible();
  const first = await page.getByText("Tacos").boundingBox();
  const second = await page.getByText("Nachos").boundingBox();
  expect(second!.y).toBeGreaterThan(first!.y);
  expect(Math.abs(second!.x - first!.x)).toBeLessThan(2);
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-menu.png` });
  }

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Darts")).toBeVisible();
  const dinnerRow = await page.getByText("Dinner").boundingBox();
  const dartsRow = await page.getByText("Darts").boundingBox();
  expect(dartsRow!.y).toBeGreaterThan(dinnerRow!.y);
  if (process.env.SHOTS) {
    await page.screenshot({ path: `${process.env.SHOTS}/tv-schedule.png` });
  }

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Tacos")).toBeVisible();
  await page.getByTestId("part-click").click();
  await expect(page.getByText("Darts")).toBeVisible();
});
