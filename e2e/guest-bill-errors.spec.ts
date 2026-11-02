import { expect, test, type Page } from "@playwright/test";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

const bill = {
  payeeName: "Sam",
  swishNumber: "46701234567",
  total: 345,
  confirmed: 0,
  owed: 345,
  status: "owes",
  lines: [{ name: "Drinks", share: 345 }],
};

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
};

/** Answers the log call and keeps what the page sent. */
async function recordLogs(page: Page) {
  const logged: Record<string, unknown>[] = [];
  await page.route(`${supabase}/rest/v1/rpc/log_client_error`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    logged.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: '"logged"',
    });
  });
  return logged;
}

/** Saves a screenshot when SHOT_DIR is set: for the before/after in a PR. */
async function shoot(page: Page, name: string) {
  const dir = process.env.SHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

test("a failed 'I've paid' shows a try-again line, is logged by code only, and can be retried", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna", bill });
  const logged = await recordLogs(page);
  let fail = true;
  await page.route(`${supabase}/rest/v1/rpc/set_i_paid`, (route) => {
    if (route.request().method() === "OPTIONS" || !fail)
      return route.fallback();
    return route.fulfill({
      status: 500,
      headers: cors,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto(`/p/${code}`);
  await page.getByTestId("bill-icon").click();
  const sheet = page.getByTestId("bill-sheet");
  await sheet.getByTestId("i-paid").click();

  await expect(sheet.getByRole("alert")).toHaveText(
    "Couldn't save that. Try again.",
  );
  await shoot(page, "after-i-paid-failed");
  await expect.poll(() => logged.length).toBe(1);
  expect(logged[0]).toMatchObject({
    kind: "handled",
    area: "costs",
    action: "i_paid",
    error_code: "unknown",
  });
  expect(JSON.stringify(logged[0])).not.toMatch(/345|0701234567|Anna/);

  fail = false;
  await sheet.getByTestId("i-paid").click();
  await expect(sheet.getByTestId("bill-says-paid")).toBeVisible();
});

test("a bill that can't be read shows a warning icon, a try-again sheet and a log row", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna", bill });
  const logged = await recordLogs(page);
  let fail = true;
  await page.route(`${supabase}/rest/v1/rpc/my_bill`, (route) => {
    if (route.request().method() === "OPTIONS" || !fail)
      return route.fallback();
    return route.fulfill({
      status: 500,
      headers: cors,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.goto(`/p/${code}`);
  await page.getByTestId("bill-error-icon").click();
  const sheet = page.getByTestId("bill-sheet");
  await expect(sheet.getByRole("alert")).toHaveText(
    "Couldn't load your bill. Try again.",
  );
  await shoot(page, "after-bill-load-failed");
  await expect.poll(() => logged.length).toBeGreaterThan(0);
  expect(logged[0]).toMatchObject({
    area: "costs",
    action: "load_bill",
    error_code: "load_failed",
  });

  fail = false;
  await sheet.getByTestId("bill-retry").click();
  await expect(page.getByTestId("bill-icon")).toBeVisible();
  await expect(page.getByTestId("bill-error-icon")).toHaveCount(0);
});

test("when the Swish app doesn't open the guest is told and it is logged", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna", bill });
  const logged = await recordLogs(page);

  await page.goto(`/p/${code}`);
  await page.getByTestId("bill-icon").click();
  const sheet = page.getByTestId("bill-sheet");
  await sheet.getByTestId("swish-button").click();

  await expect(sheet.getByRole("alert")).toContainText("Swish didn't open");
  await shoot(page, "after-swish-not-opened");
  await expect.poll(() => logged.length).toBe(1);
  expect(logged[0]).toMatchObject({
    action: "open_swish",
    error_code: "app_not_opened",
  });
});
