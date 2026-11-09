import { expect, test } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import {
  fakeEvent,
  fakeSupabase,
  fakeTv,
  realtimeControl,
} from "./fake-supabase.ts";

const code = "ABC234";

test("the TV shows a reconnecting note after a long drop and removes it when back", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fakeSupabase(page, []);
  await fakeTv(page, {
    snapshot: {
      ...eventRow({ id: "e1", code }),
      members: [memberRow({ user_id: "t", role: "tv", display_name: null })],
    },
  });
  await page.goto(`/tv/${code}`);
  await expect(page.getByTestId("tv-code")).toHaveText(code);
  await expect(page.getByTestId("reconnecting")).toHaveCount(0);

  const realtime = realtimeControl(page);
  realtime.drop();
  await expect(page.getByTestId("reconnecting")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByTestId("reconnecting")).toHaveText("Reconnecting…");

  realtime.restore();
  await expect(page.getByTestId("reconnecting")).toHaveCount(0, {
    timeout: 40_000,
  });
});

test("a guest phone shows the same note and keeps the page", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await page.goto(`/p/${code}`);
  await expect(page.getByText("Anna").first()).toBeVisible();

  const realtime = realtimeControl(page);
  realtime.drop();
  await expect(page.getByTestId("reconnecting")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("Anna").first()).toBeVisible();

  realtime.restore();
  await expect(page.getByTestId("reconnecting")).toHaveCount(0, {
    timeout: 40_000,
  });
});
