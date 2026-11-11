import { expect, test } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import {
  fakeHostPanel,
  fakeSupabase,
  fakeTv,
  recordRequestUrls,
} from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

test.use({
  viewport: { width: 1440, height: 900 },
  isMobile: false,
  hasTouch: false,
});

const guests = [
  memberRow({ user_id: anna, display_name: "Anna" }),
  memberRow({ user_id: bertil, display_name: "Bertil" }),
];

test("the right column mirrors the TV without joining as a TV", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    party: { welcome: "Welcome to Friday!" },
  });
  const urls = recordRequestUrls(page);
  await page.goto(`/host/${code}?view=run#key=${key}`);

  const side = page.getByTestId("host-side");
  const mirror = side.getByTestId("tv-mirror");
  await expect(mirror).toContainText("Welcome to Friday!");
  // Read-only: out of the accessibility tree and not clickable.
  await expect(mirror.locator("[inert][aria-hidden=true]")).toHaveCount(1);
  expect(urls.some((url) => url.includes("join_tv"))).toBe(false);
});

test("the column shows only the TV, the next point and the message field", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    party: {
      schedule: [
        { time: "00:00", title: "Doors open" },
        { time: "23:59", title: "Last dance" },
      ],
    },
  });
  await page.goto(`/host/${code}?view=run#key=${key}`);

  const side = page.getByTestId("host-side");
  await expect(side.getByTestId("tv-mirror")).toBeVisible();
  const next = side.getByTestId("side-next");
  await expect(next).toContainText("23:59");
  await expect(next).toContainText("Last dance");
  await expect(next).not.toContainText("Doors open");
  await expect(side.getByTestId("side-message")).toBeVisible();
  // Moved elsewhere: code, copy buttons, Open TV and the guest list.
  await expect(side.getByTestId("side-event-code")).toHaveCount(0);
  // (the TV copy is inert, so it has no buttons or links of its own)
  await expect(side.getByRole("button", { name: /Copy/ })).toHaveCount(0);
  await expect(side.getByRole("link", { name: "Open TV" })).toHaveCount(0);
  await expect(side.getByTestId("side-guests")).toHaveCount(0);
});

test("no next point is rendered without a program", async ({ page }) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });
  await page.goto(`/host/${code}?view=run#key=${key}`);
  await expect(page.getByTestId("side-message")).toBeVisible();
  await expect(page.getByTestId("side-next")).toHaveCount(0);
});

test("the message field sends a notice and clears", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });
  await page.goto(`/host/${code}?view=run#key=${key}`);

  const message = page.getByTestId("host-side").getByTestId("side-message");
  const send = message.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  const field = message.getByLabel("Message to the guests");
  await field.fill("Food is ready!");
  await send.click();
  await expect(message.getByTestId("side-message-sent")).toContainText(
    "Food is ready!",
  );
  await expect(field).toHaveValue("");
  expect(bodies.at(-1)).toEqual({
    action: "send_notice",
    code,
    key,
    text: "Food is ready!",
  });
});

test("the message field takes spaces beside the TV mirror", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });
  await page.goto(`/host/${code}?view=run#key=${key}`);

  const field = page
    .getByTestId("host-side")
    .getByTestId("side-message")
    .getByLabel("Message to the guests");
  await field.click();
  await page.keyboard.type("Food is ready");
  await expect(field).toHaveValue("Food is ready");
});

test("the column is not rendered in Prepare", async ({ page }) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  await expect(page.getByTestId("host-main")).toBeVisible();
  await expect(page.getByTestId("host-side")).toHaveCount(0);
});

test("the mirror says the same as the real TV", async ({ page, context }) => {
  const welcome = "Welcome to Friday!";
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests,
    party: { welcome },
  });
  await page.goto(`/host/${code}?view=run#key=${key}`);
  const mirror = page.getByTestId("tv-mirror");
  await expect(mirror).toContainText(welcome);

  // The same evening on a real TV, in a second tab.
  const tv = await context.newPage();
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await fakeSupabase(tv, []);
  await fakeTv(tv, {
    snapshot: {
      ...eventRow({ id: "e1", code, party: { welcome } }),
      members: [{ ...memberRow({ user_id: "t", role: "tv" }) }, ...guests],
    },
  });
  await tv.goto(`/tv/${code}`);
  await expect(tv.getByTestId("welcome-text")).toHaveText(welcome);

  for (const id of ["welcome-text", "tv-code", "join-address", "guest-count"]) {
    const onTv = await tv.getByTestId(id).first().innerText();
    await expect(mirror.getByTestId(id).first()).toHaveText(onTv);
  }
});
