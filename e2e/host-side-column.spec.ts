import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import {
  fakeHostPanel,
  fakeSupabase,
  recordRequestUrls,
} from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

test.use({ viewport: { width: 1440, height: 900 } });

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
  await page.goto(`/host/${code}#key=${key}`);

  const side = page.getByTestId("host-side");
  await expect(side.getByTestId("side-event-code")).toHaveText(code);
  const mirror = side.getByTestId("tv-mirror");
  await expect(mirror).toContainText("Welcome to Friday!");
  // Read-only: out of the accessibility tree and not clickable.
  await expect(mirror.locator("[inert][aria-hidden=true]")).toHaveCount(1);
  expect(urls.some((url) => url.includes("join_tv"))).toBe(false);
});

test("guest tools and the message field work from the column", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [200, {}],
    () => [200, {}],
  ]);
  await fakeHostPanel(page, { code, enabledModules: [], guests });
  await page.goto(`/host/${code}#key=${key}`);

  const side = page.getByTestId("host-side");
  const list = side.getByTestId("side-guests");
  await expect(list.getByTestId("side-guest-count")).toHaveText("2");
  await expect(list).toContainText("+ latest: Bertil");

  await list.getByRole("button", { name: "Anna" }).click();
  await list.getByRole("button", { name: "Remove" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();
  expect(bodies.at(-1)).toEqual({
    action: "remove_guest",
    code,
    key,
    userId: anna,
  });

  const message = side.getByTestId("side-message");
  const send = message.getByRole("button", { name: "Send" });
  await expect(send).toBeDisabled();
  await message.getByLabel("Message to the guests").fill("Food is ready!");
  await send.click();
  await expect(message.getByTestId("side-message-sent")).toContainText(
    "Food is ready!",
  );
  expect(bodies.at(-1)).toEqual({
    action: "send_notice",
    code,
    key,
    text: "Food is ready!",
  });
});
