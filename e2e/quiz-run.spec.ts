import { expect, test } from "@playwright/test";
import { eventRow, memberRow } from "./fake-rows.ts";
import {
  fakeHostPanel,
  fakeSupabase,
  fakeTv,
  type FakeQuizRow,
} from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);

const questions: FakeQuizRow[] = [
  {
    id: "q1",
    position: 0,
    text: "Capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correct: 2,
  },
  {
    id: "q2",
    position: 1,
    text: "Feta comes from?",
    options: ["Italy", "Greece", "Turkey", "Spain"],
    correct: 1,
  },
];

function quizAt(current_step: number, phase: string) {
  return { status: "live", current_module: "quiz", current_step, phase };
}

test.describe("the control panel", () => {
  test("starts the quiz and says why a start was refused", async ({ page }) => {
    const bodies = await fakeSupabase(page, [
      () => [200, {}],
      () => [409, { error: "module_finished" }],
    ]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz"],
      quiz: questions,
      played: 2,
    });

    await page.goto(`/host/${code}#key=${key}`);
    await openSection(page, "activity-quiz");
    const panel = page.getByTestId("quiz-host");
    await expect(panel).toContainText("Every question has been played.");
    await panel.getByRole("button", { name: "Start quiz" }).click();

    await expect(panel.getByRole("alert")).toHaveText(
      "This has already been played to the end, so it can't start again.",
    );
    expect(bodies[1]).toEqual({
      action: "set_flow",
      code,
      key,
      move: { type: "start_module", module: "quiz" },
    });
  });

  test("shows the current question with its right answer and the next move", async ({
    page,
  }) => {
    const bodies = await fakeSupabase(page, [
      () => [200, {}],
      () => [200, quizAt(2, "idle")],
    ]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz"],
      quiz: questions,
      played: 2,
      flow: quizAt(1, "revealed"),
    });

    await page.goto(`/host/${code}#key=${key}`);
    await openSection(page, "activity-quiz");
    const panel = page.getByTestId("quiz-host");
    await expect(panel.getByTestId("quiz-progress")).toHaveText(
      "Question 2 of 2",
    );
    await expect(panel.getByText("2. Feta comes from?")).toBeVisible();
    await expect(panel.getByText("B. Greece")).toContainText("Right answer");
    await expect(panel.getByRole("button", { name: "Stop" })).toBeVisible();

    await panel.getByRole("button", { name: "Show results" }).click();

    await expect
      .poll(() => bodies[1])
      .toMatchObject({
        move: { type: "next_step" },
      });
  });

  test("shows how many have answered and who, never what", async ({ page }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz"],
      quiz: [{ ...questions[0], answerCount: 2 }],
      flow: quizAt(0, "open"),
      guests: [
        memberRow({ user_id: "g1", display_name: "Anna" }),
        memberRow({ user_id: "g2", display_name: "Bertil" }),
        memberRow({ user_id: "g3", display_name: "Cecilia" }),
      ],
      answeredBy: ["g1", "g3"],
    });

    await page.goto(`/host/${code}#key=${key}`);
    await openSection(page, "activity-quiz");

    const answered = page.getByTestId("quiz-host").getByTestId("quiz-answered");
    await expect(answered).toContainText("2 of 3 answered");
    await expect(answered.getByRole("listitem")).toHaveText([
      "Anna",
      "Cecilia",
    ]);
  });

  test("shows the full score list and Back to party screen on the results step", async ({
    page,
  }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz"],
      quiz: questions,
      played: 2,
      flow: quizAt(2, "idle"),
      scores: [
        { name: "Anna", score: 2, place: 1 },
        { name: "Dennis", score: 0, place: 2 },
      ],
    });

    await page.goto(`/host/${code}#key=${key}`);
    await openSection(page, "activity-quiz");

    const panel = page.getByTestId("quiz-host");
    await expect(
      panel.getByTestId("quiz-scores").getByRole("listitem"),
    ).toHaveText(["1Anna2 points", "2Dennis0 points"]);
    await expect(
      panel.getByRole("button", { name: "Back to party screen" }),
    ).toBeVisible();
    await expect(
      panel.getByRole("button", { name: "Show results" }),
    ).toHaveCount(0);
  });

  test("labels the one button for each phase", async ({ page }) => {
    await fakeSupabase(page, [() => [200, {}]]);
    await fakeHostPanel(page, {
      code,
      enabledModules: ["quiz"],
      quiz: questions,
      flow: quizAt(0, "open"),
    });

    await page.goto(`/host/${code}#key=${key}`);
    await openSection(page, "activity-quiz");

    await expect(
      page.getByTestId("quiz-host").getByRole("button", { name: "Reveal" }),
    ).toBeVisible();
    await expect(page.getByTestId("tv-now")).toContainText(
      "Quiz, question 1 of 2, open",
    );
  });
});

test.describe("the TV", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  function snapshot(current_step: number, phase: string) {
    return {
      ...eventRow({
        id: "e1",
        code,
        enabled_modules: ["quiz"],
        ...quizAt(current_step, phase),
      }),
      members: [memberRow({ user_id: "t", role: "tv" })],
    };
  }

  test("says which question is coming", async ({ page }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: snapshot(2, "idle"),
      quiz: { rows: [], total: 10, played: 2 },
    });

    await page.goto(`/tv/${code}`);

    const quiz = page.getByTestId("quiz-tv");
    await expect(quiz).toContainText("Question 3 of 10");
    await expect(quiz).toContainText("Get ready!");
    await expect(page.getByTestId("tv-code")).toHaveText(code);
  });

  test("shows the open question with its options", async ({ page }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: snapshot(0, "open"),
      quiz: { rows: [{ ...questions[0], correct: null }], total: 2 },
    });

    await page.goto(`/tv/${code}`);

    const quiz = page.getByTestId("quiz-tv");
    await expect(quiz.getByRole("heading")).toHaveText("Capital of Australia?");
    await expect(quiz.getByRole("listitem")).toHaveText([
      "ASydney",
      "BMelbourne",
      "CCanberra",
      "DPerth",
    ]);
    await expect(quiz.locator("[data-correct]")).toHaveCount(0);
  });

  test("shows how many of the guests have answered", async ({ page }) => {
    const guests = Array.from({ length: 12 }, (_, i) =>
      memberRow({ user_id: `g${i}`, display_name: `Guest ${i}` }),
    );
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: {
        ...snapshot(0, "open"),
        members: [memberRow({ user_id: "t", role: "tv" }), ...guests],
      },
      quiz: { rows: [{ ...questions[0], correct: null, answerCount: 7 }] },
    });

    await page.goto(`/tv/${code}`);

    await expect(page.getByTestId("quiz-answered")).toHaveText(
      "7 of 12 answered",
    );
  });

  test("shows a bar per option with its votes after the reveal", async ({
    page,
  }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: snapshot(0, "revealed"),
      quiz: { rows: [questions[0]], total: 2, played: 1, votes: [1, 0, 5, 2] },
    });

    await page.goto(`/tv/${code}`);

    const quiz = page.getByTestId("quiz-tv");
    await expect(quiz.getByTestId("quiz-votes")).toHaveText([
      "1",
      "0",
      "5",
      "2",
    ]);
    await expect(quiz.getByTestId("quiz-bar")).toHaveCount(4);
    await expect(quiz.getByTestId("quiz-answered")).toHaveCount(0);
  });

  test("shows the top 3 places with names and points on the results step", async ({
    page,
  }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: snapshot(2, "revealed"),
      quiz: {
        rows: [],
        total: 2,
        played: 2,
        scores: [
          { name: "Anna", score: 2, place: 1 },
          { name: "Bertil", score: 2, place: 1 },
          { name: "Cecilia", score: 1, place: 3 },
        ],
      },
    });

    await page.goto(`/tv/${code}`);

    const quiz = page.getByTestId("quiz-tv");
    await expect(quiz.getByRole("heading")).toHaveText("Results");
    await expect(quiz.getByRole("listitem")).toHaveText([
      "1Anna2 points",
      "1Bertil2 points",
      "3Cecilia1 point",
    ]);
  });

  test("highlights the right option after the reveal", async ({ page }) => {
    await fakeSupabase(page, []);
    await fakeTv(page, {
      snapshot: snapshot(0, "revealed"),
      quiz: { rows: [questions[0]], total: 2, played: 1 },
    });

    await page.goto(`/tv/${code}`);

    await expect(
      page.getByTestId("quiz-tv").locator("[data-correct]"),
    ).toHaveText(/CCanberra/);
  });
});
