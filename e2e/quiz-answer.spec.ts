import { expect, test, type Page, type Route } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import { fakeEvent, fakeSupabase, supabase } from "./fake-supabase.ts";

const code = "ABC234";

const question = {
  id: "q1",
  position: 0,
  text: "Capital of Australia?",
  options: ["Sydney", "Melbourne", "Canberra", "Perth"],
  answer_count: 0,
};

/** What the fake database holds, which the test changes as the quiz moves. */
interface QuizWorld {
  phase: "open" | "revealed";
  /** The quiz step; 2 is the results step, after the last question. */
  step?: number;
  /** What quiz_scores gives this guest. */
  scores?: Array<{
    user_id: string;
    display_name: string;
    score: number;
    place: number;
  }>;
  /** The guest's stored answer. */
  chosen: number | null;
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
 * Fakes the quiz on a guest's phone on top of `fakeEvent`: the event with the
 * quiz running on question 1, the question with its key once revealed, and the
 * guest's own answer row (insert, change, read).
 */
async function fakeQuiz(page: Page, world: QuizWorld) {
  await page.route(`${supabase}/rest/v1/events*`, (route) => {
    if (!route.request().url().includes("id=eq.")) return route.fallback();
    return json(route, 200, [
      {
        ...eventRow({
          code,
          enabled_modules: ["quiz"],
          status: "live",
          current_module: "quiz",
          current_step: world.step ?? 0,
          phase: world.phase,
        }),
        members: [memberRow({ display_name: "Anna" })],
      },
    ]);
  });
  await page.route(`${supabase}/rest/v1/rpc/quiz_progress`, (route) =>
    json(route, 200, [
      { total: 2, played: world.phase === "revealed" ? 1 : 0 },
    ]),
  );
  await page.route(`${supabase}/rest/v1/rpc/quiz_scores`, (route) =>
    json(route, 200, world.scores ?? []),
  );
  await page.route(`${supabase}/rest/v1/quiz_questions*`, (route) =>
    json(route, 200, [
      {
        ...question,
        quiz_answer_keys: world.phase === "revealed" ? { correct: 2 } : null,
      },
    ]),
  );
  await page.route(`${supabase}/rest/v1/quiz_answers*`, (route) => {
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
        world.chosen === null ? [] : [{ chosen: world.chosen }],
      );
    }
    const body = request.postDataJSON() as { chosen: number };
    world.writes.push({ method: request.method(), body });
    if (request.method() === "PATCH") {
      if (world.chosen === null) return json(route, 200, []);
      world.chosen = body.chosen;
      return json(route, 200, [{ chosen: body.chosen }]);
    }
    world.chosen = body.chosen;
    return route.fulfill({
      status: 201,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

/** The page reads the event again when its tab becomes visible. */
function refetch(page: Page) {
  return page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");
}

test("a guest answers, changes the answer and sees the result after the reveal", async ({
  page,
}) => {
  const world: QuizWorld = { phase: "open", chosen: null, writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeQuiz(page, world);

  await page.goto(`/p/${code}`);
  const quiz = page.getByTestId("quiz-guest");
  await expect(quiz.getByRole("heading")).toHaveText("Capital of Australia?");
  const buttons = quiz.getByRole("button");
  await expect(buttons).toHaveText([
    "ASydney",
    "BMelbourne",
    "CCanberra",
    "DPerth",
  ]);

  // The question leads: no welcome heading while a question is open.
  await expect(page.getByRole("heading", { name: /You're in/ })).toBeHidden();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await expect(quiz.getByText("0 of 1 have answered")).toBeVisible();
  await expect(
    quiz.getByText(/change your answer until the reveal/),
  ).toBeVisible();

  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(buttons.nth(1)).toContainText("Your answer");
  await expect(quiz.getByText("1 of 1 has answered")).toBeVisible();
  await buttons.nth(2).click();
  await expect(buttons.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "false");
  expect(world.writes).toMatchObject([
    { method: "PATCH", body: { chosen: 1 } },
    { method: "POST", body: { chosen: 1, question_id: "q1" } },
    { method: "PATCH", body: { chosen: 2 } },
  ]);

  // The host reveals; the page follows when it next reads the event.
  world.phase = "revealed";
  await refetch(page);

  await expect(page.getByTestId("quiz-result")).toHaveText("Right! +1");
  await expect(quiz.getByRole("button")).toHaveCount(0);
});

test("a guest sees their score after a reveal and their place at the end", async ({
  page,
}) => {
  const world: QuizWorld = {
    phase: "revealed",
    chosen: 2,
    writes: [],
    scores: [{ user_id: "u1", display_name: "Anna", score: 1, place: 1 }],
  };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeQuiz(page, world);

  await page.goto(`/p/${code}`);
  await expect(page.getByTestId("quiz-score")).toHaveText(
    "Your score so far: 1 point",
  );

  world.step = 2;
  world.scores = [{ user_id: "u1", display_name: "Anna", score: 2, place: 3 }];
  await refetch(page);
  await expect(page.getByTestId("quiz-final")).toContainText(
    "You finished in place 3",
  );
  await expect(page.getByTestId("quiz-final")).toContainText(
    "You got 2 points",
  );
});

test("a guest who picked wrong is told the right answer", async ({ page }) => {
  const world: QuizWorld = { phase: "open", chosen: 0, writes: [] };
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });
  await fakeQuiz(page, world);

  await page.goto(`/p/${code}`);
  await expect(
    page.getByTestId("quiz-guest").getByRole("button").first(),
  ).toHaveAttribute("aria-pressed", "true");

  world.phase = "revealed";
  await refetch(page);

  await expect(page.getByTestId("quiz-result")).toHaveText("The answer was C");
});
