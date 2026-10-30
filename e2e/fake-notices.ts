import type { Page } from "@playwright/test";
import { fakeEventId } from "./fake-rows.ts";
import { supabase } from "./fake-supabase.ts";

export interface FakeNotice {
  id: string;
  text: string;
  created_at: string;
}

/**
 * Answers the notices read of a guest's phone with whatever `read` returns at
 * that moment, so a test can add or delete notices mid-way. Register it after
 * `fakeEvent`, which it overrides for the notices table. Returns how many
 * times the phone read them.
 */
export async function fakeNotices(page: Page, read: () => FakeNotice[]) {
  const reads = { count: 0 };
  await page.route(`${supabase}/rest/v1/notices*`, (route) => {
    const request = route.request();
    const headers = { "access-control-allow-origin": "*" };
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-headers":
            request.headers()["access-control-request-headers"] ?? "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    reads.count += 1;
    const rows = read()
      .map((row) => ({ ...row, event_id: fakeEventId }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return route.fulfill({
      status: 200,
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(rows),
    });
  });
  return reads;
}
