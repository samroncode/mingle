import { expect, test } from "@playwright/test";
import { fakeSupabase, recordRequestUrls } from "./fake-supabase.ts";

const code = "ABC234";
const key = "b".repeat(43);

const badLinks = [
  { name: "a missing key", path: `/host/${code}` },
  { name: "a malformed key", path: `/host/${code}#key=short` },
  { name: "an invalid code", path: `/host/abc#key=${key}` },
];

for (const { name, path } of badLinks) {
  test(`says the link doesn't work for ${name}`, async ({ page }) => {
    const bodies = await fakeSupabase(page, []);
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "This link doesn't work" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Go to the start page" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(bodies).toEqual([]);
  });
}

test("says the link doesn't work when the server refuses the key", async ({
  page,
}) => {
  const urls = recordRequestUrls(page);
  const bodies = await fakeSupabase(page, [
    () => [403, { error: "not_authorized" }],
  ]);
  await page.goto(`/host/${code}#key=${key}`);
  await expect(
    page.getByRole("heading", { name: "This link doesn't work" }),
  ).toBeVisible();

  expect(bodies).toEqual([{ action: "claim_host", code, key }]);
  // The key travels only in the request body, and the page doesn't show it.
  expect(urls.some((url) => url.includes(key))).toBe(false);
  await expect(page.locator("body")).not.toContainText(key);
});

test("shows its own message when rate limited, and can try again", async ({
  page,
}) => {
  await fakeSupabase(page, [
    () => [429, { error: "rate_limited" }],
    () => [200, {}],
  ]);
  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByRole("alert")).toContainText("Too many tries");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
});
