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

test("the TV starts in the event's language", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakeTv(page, { snapshot: snapshot({ language: "sv" }) });
  await page.goto(`/tv/${code}`);
  await expect(page.getByTestId("guest-count")).toHaveText(
    "2 gäster har gått med",
  );
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
