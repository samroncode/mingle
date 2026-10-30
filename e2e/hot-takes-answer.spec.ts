import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

/** What the fake database holds, which the test changes as the take moves. */
interface HotTakesWorld {
  /** The guest's stored answer (true = agree). */
  agree: boolean | null;
  /** The requests that wrote an answer. */
  writes: Array<{ method: string; body: unknown }>;
}

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

/**
 * Fakes the hot takes on a guest's phone on top of `fakeEvent`: the event
 * with hot take 1 open, two guests, the hot take (with 1 answer counted), and
 * the guest's own answer row (insert, change, read).
 */
async function fakeHotTakes(page: Page, world: HotTakesWorld) {
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, 200, [
      {
        ...eventRow({
          code,
          enabled_modules: ["hottakes"],
          status: "live",
          current_module: "hottakes",
          current_step: 0,
          phase: "open",
        }),
        members: [
          memberRow({ display_name: "Anna" }),
          memberRow({ user_id: "g2", display_name: "Bertil" }),
          memberRow({ user_id: "t1", role: "tv" }),
        ],
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/rpc/hot_take_progress`, (route) =>
    json(route, 200, [{ total: 2, revealed: 0 }]),
  );
  await page.route(`${supabase}/rest/v1/hot_takes*`, (route) =>
    json(route, 200, [
      {
        id: "h1",
        position: 0,
        text: "Pineapple belongs on pizza",
        answer_count: 1,
        revealed_at: null,
      },
    ]),
  );
  await page.route(`${supabase}/rest/v1/hot_take_answers*`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers":
            request.headers()["access-control-request-headers"] ?? "*",
          "access-control-allow-methods": "*",
        },
      });
    }
    if (request.method() === "GET") {
      return json(
        route,
        200,
        world.agree === null ? [] : [{ agree: world.agree }],
      );
    }
    const body = request.postDataJSON() as { agree: boolean };
    world.writes.push({ method: request.method(), body });
    if (request.method() === "PATCH") {
      if (world.agree === null) return json(route, 200, []);
      world.agree = body.agree;
      return json(route, 200, [{ agree: body.agree }]);
    }
    world.agree = body.agree;
    return route.fulfill({
      status: 201,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test("a guest agrees with a hot take and changes the answer", async ({
  page,
}) => {
  const world: HotTakesWorld = { agree: null, writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeHotTakes(page, world);

  await page.goto(`/p/${code}`);
  const guest = page.getByTestId("hottakes-guest");
  await expect(guest.getByRole("heading")).toHaveText(
    "Pineapple belongs on pizza",
  );
  // The take leads: no welcome heading while it is open.
  await expect(page.getByRole("heading", { name: /You're in/ })).toBeHidden();
  const agree = guest.getByRole("button", { name: /^Agree/ });
  const disagree = guest.getByRole("button", { name: "Disagree" });

  await agree.click();
  await expect(agree).toHaveAttribute("aria-pressed", "true");
  await disagree.click();
  await expect(disagree).toHaveAttribute("aria-pressed", "true");
  await expect(agree).toHaveAttribute("aria-pressed", "false");
  expect(world.writes).toMatchObject([
    { method: "PATCH", body: { agree: true } },
    { method: "POST", body: { agree: true, hot_take_id: "h1" } },
    { method: "PATCH", body: { agree: false } },
  ]);
});

test("a stored answer is marked when the phone opens", async ({ page }) => {
  const world: HotTakesWorld = { agree: false, writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeHotTakes(page, world);

  await page.goto(`/p/${code}`);
  await expect(page.getByRole("button", { name: "Disagree" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
