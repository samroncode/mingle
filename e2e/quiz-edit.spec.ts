import { expect, test, type Page } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);

/** One played question and one of the host's own still to play. */
async function openPanel(page: Page, updateAnswer: [number, object]) {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => updateAnswer,
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz"],
    status: "live",
    played: 1,
    quiz: [
      {
        id: "q1",
        position: 0,
        text: "Capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correct: 2,
        played: true,
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
  await openSection(page, "activity-quiz");
  await page.getByRole("button", { name: "Edit questions" }).click();
  return bodies;
}

test("the host edits the unplayed quiz questions in the control panel", async ({
  page,
}) => {
  const bodies = await openPanel(page, [200, {}]);
  const editor = page.getByTestId("quiz-edit");

  // The played question is locked; the unplayed one is the host's to edit.
  await expect(editor.getByText("1. Capital of Australia?")).toBeVisible();
  await expect(editor.getByText("Played, can't be changed")).toBeVisible();
  await expect(editor.getByText("2 of 30 questions picked")).toBeVisible();
  await editor.getByLabel("Text of question 2").fill("Where is feta from?");
  await editor.getByRole("button", { name: "Save questions" }).click();

  await expect(editor).toHaveCount(0);
  expect(bodies[1]).toEqual({
    action: "update_quiz",
    code,
    key,
    questions: [
      {
        text: "Where is feta from?",
        options: ["Italy", "Greece", "Turkey", "Spain"],
        correct: 1,
      },
    ],
  });
});

test("the control panel says why a quiz edit was refused", async ({ page }) => {
  await openPanel(page, [409, { error: "invalid_transition" }]);

  await page.getByRole("button", { name: "Save questions" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Questions can't be changed while a question is on the TV",
  );
  await expect(page.getByTestId("quiz-edit")).toBeVisible();
});
