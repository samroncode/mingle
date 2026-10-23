import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "c".repeat(43);

test("the host edits the picked quiz questions in the wizard", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  // Afterwork, English, then the activities step with the quiz on.
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("10 of 30 questions picked")).toBeVisible();

  // Untick the first question and tick another ready-made one.
  const picked = page.locator("ol > li");
  await expect(picked).toHaveCount(10);
  const firstText = await picked.first().locator("p").first().innerText();
  await page
    .getByRole("button", { name: "Remove question 1", exact: true })
    .click();
  await expect(page.getByText("9 of 30 questions picked")).toBeVisible();
  await expect(
    page.getByRole("main").getByText(firstText, { exact: true }),
  ).toHaveCount(1); // Offered again under "More ready-made questions".

  // An unfinished question of the host's own blocks Next with a message.
  await page.getByRole("button", { name: "Add your own question" }).click();
  await page.getByLabel("Text of question 10").fill("Who baked the cake?");
  await expect(page.getByRole("alert")).toContainText(
    "Question 10 needs a question and four options",
  );
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  for (const [letter, text] of [
    ["A", "Anna"],
    ["B", "Bertil"],
    ["C", "Cecilia"],
    ["D", "David"],
  ] as const) {
    await page.getByLabel(`Option ${letter} of question 10`).fill(text);
  }
  await page.getByLabel("Option C is the right answer to question 10").check();
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Move it to the top, so the order is the host's.
  for (let i = 0; i < 9; i++) {
    await page
      .getByRole("button", { name: `Move question ${10 - i} up` })
      .click();
  }
  await expect(page.getByLabel("Text of question 1")).toHaveValue(
    "Who baked the cake?",
  );

  // The picks survive a reload.
  await page.reload();
  await expect(page.getByLabel("Text of question 1")).toHaveValue(
    "Who baked the cake?",
  );
  await expect(page.getByText("10 of 30 questions picked")).toBeVisible();

  // Skip the rest (awards included) and create.
  for (let i = 0; i < 6; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByText("10 questions")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  const body = bodies[0] as { quiz: { text: string; correct: number }[] };
  expect(body.quiz).toHaveLength(10);
  expect(body.quiz[0]).toEqual({
    text: "Who baked the cake?",
    options: ["Anna", "Bertil", "Cecilia", "David"],
    correct: 2,
  });
  expect(body.quiz.some((q) => q.text === firstText)).toBe(false);
});

test("the quiz step is left out when the quiz is switched off", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("switch", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  // Awards are still on, so their step follows the activities.
  await expect(
    page.getByRole("heading", { name: "Award categories" }),
  ).toBeVisible();

  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).not.toHaveProperty("quiz");
});

test("the control panel lists the quiz questions with the right answer", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz"],
    quiz: [
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
    ],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("quiz-host");
  await expect(panel.getByText("1. Capital of Australia?")).toBeVisible();
  await expect(panel.getByText("2. Feta comes from?")).toBeVisible();
  await expect(panel.getByText("C. Canberra")).toContainText("Right answer");
  await expect(panel.getByText("A. Sydney")).not.toContainText("Right answer");
  await expect(panel.getByText("B. Greece")).toContainText("Right answer");
});

test("the control panel says when the quiz has no questions", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: ["quiz"] });

  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByTestId("quiz-host")).toContainText(
    "There are no questions in this quiz yet.",
  );
});
