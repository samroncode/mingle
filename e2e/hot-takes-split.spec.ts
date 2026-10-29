import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

/** What the fake database holds, which the test changes as the room moves on. */
interface SplitWorld {
  phase: "open" | "revealed";
  /** 0 is the first hot take; 2 is the summary step (two hot takes). */
  step: number;
  /** The guest's stored answer (true = agree). */
  agree: boolean | null;
  /** The room's split on the first hot take. */
  split: { agree_count: number; disagree_count: number };
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
 * Fakes the hot takes on a guest's phone on top of `fakeEvent`: the event at
 * the world's step and phase, two hot takes, the guest's answer, and the
 * results functions.
 */
async function fakeSplit(page: Page, world: SplitWorld) {
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, 200, [
      {
        ...eventRow({
          code,
          enabled_modules: ["hottakes"],
          status: "live",
          current_module: "hottakes",
          current_step: world.step,
          phase: world.step >= 2 ? "idle" : world.phase,
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
    json(route, 200, [
      { total: 2, revealed: world.step + (world.phase === "revealed" ? 1 : 0) },
    ]),
  );
  await page.route(`${supabase}/rest/v1/hot_takes*`, (route) =>
    json(route, 200, [
      {
        id: "h1",
        position: 0,
        text: "Pineapple belongs on pizza",
        answer_count: 3,
        revealed_at: world.phase === "revealed" ? "2026-10-29T20:00:00Z" : null,
      },
    ]),
  );
  await page.route(`${supabase}/rest/v1/rpc/hot_take_result`, (route) =>
    json(route, 200, world.phase === "revealed" ? [world.split] : []),
  );
  await page.route(`${supabase}/rest/v1/rpc/hot_take_highlights`, (route) =>
    json(route, 200, [
      {
        highlight: "agreed",
        hot_take_id: "h2",
        hot_take_position: 1,
        hot_take_text: "Mondays are fine",
        agree_count: 4,
        disagree_count: 0,
      },
      {
        highlight: "divisive",
        hot_take_id: "h1",
        hot_take_position: 0,
        hot_take_text: "Pineapple belongs on pizza",
        agree_count: 2,
        disagree_count: 1,
      },
    ]),
  );
  await page.route(`${supabase}/rest/v1/rpc/my_hot_take_majority`, (route) =>
    json(route, 200, [{ sided: 1, answered: 2 }]),
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
    world.agree = body.agree;
    if (request.method() === "PATCH") {
      return json(
        route,
        200,
        world.agree === null ? [] : [{ agree: body.agree }],
      );
    }
    return route.fulfill({
      status: 201,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test.use({ viewport: { width: 390, height: 844 } });

test("the host picks hot takes, then a guest answers and sees the split", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, { code, key: "d".repeat(43) }],
  ]);

  // The host keeps the ready-made eight and creates the event.
  await page.goto("/new");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(page.getByText("8 of 20 hot takes picked")).toBeVisible();
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect((bodies[0] as { hottakes: unknown[] }).hottakes).toHaveLength(8);

  // A guest answers the open hot take, then the host reveals it.
  const world: SplitWorld = {
    phase: "open",
    step: 0,
    agree: null,
    split: { agree_count: 3, disagree_count: 1 },
  };
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeSplit(page, world);
  await page.goto(`/p/${code}`);
  const guest = page.getByTestId("hottakes-guest");
  await guest.getByRole("button", { name: "Agree", exact: true }).click();
  await expect(guest.getByTestId("hottakes-split")).toHaveCount(0);

  world.phase = "revealed";
  await page.reload();
  await expect(guest.getByTestId("hottakes-split-agree")).toContainText(
    "Agree 75% (3)",
  );
  await expect(guest.getByTestId("hottakes-split-disagree")).toContainText(
    "Disagree 25% (1)",
  );
  await expect(guest.getByTestId("hottakes-standing")).toHaveText(
    "You're with the majority",
  );
});

test("the guest sees the room split evenly and the summary", async ({
  page,
}) => {
  const world: SplitWorld = {
    phase: "revealed",
    step: 0,
    agree: true,
    split: { agree_count: 2, disagree_count: 2 },
  };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeSplit(page, world);

  await page.goto(`/p/${code}`);
  const guest = page.getByTestId("hottakes-guest");
  await expect(guest.getByText("The room is split evenly")).toHaveCount(2);

  world.step = 2;
  await page.reload();
  await expect(guest.getByTestId("hottakes-highlight-divisive")).toContainText(
    "Pineapple belongs on pizza",
  );
  await expect(guest.getByTestId("hottakes-highlight-agreed")).toContainText(
    "Mondays are fine",
  );
  await expect(guest.getByTestId("hottakes-my-majority")).toHaveText(
    "You sided with the majority 1 of 2 times",
  );
});
