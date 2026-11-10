import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { isDesktop } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);

test("the control panel starts shut, with a summary on each header", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz"],
    party: { welcome: "Welcome!" },
    quiz: [
      {
        id: "q1",
        position: 0,
        text: "Capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correct: 2,
      },
    ],
    guests: [
      memberRow({
        user_id: "00000000-0000-4000-8000-0000000000a1",
        display_name: "Anna",
      }),
    ],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const quiz = page.getByTestId("activity-quiz");
  await expect(quiz).toContainText("1 question, not started");
  await expect(page.getByTestId("party-screen")).toContainText(
    "1 of 5 parts filled in",
  );
  await expect(page.getByTestId("host-guests")).toContainText("1 guest");

  if (isDesktop(page)) {
    // The dashboard has no accordion: the summaries and the guest list show
    // at once, and the quiz is edited in a fold that opens from its cell.
    await expect(page.getByTestId("host-side")).toContainText("Anna");
    await page.screenshot({ path: "test-results/host-panel-dashboard.png" });
    await page.getByRole("button", { name: "Edit Quiz" }).click();
    const fold = page.getByRole("region", { name: "Quiz" });
    await expect(fold.getByText("1. Capital of Australia?")).toBeVisible();
    return;
  }

  // Nothing but headers until a section is opened.
  await expect(page.getByText("Capital of Australia?")).toHaveCount(0);
  await expect(page.getByText("Anna", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Welcome!")).toHaveCount(0);

  await page.screenshot({ path: "test-results/host-panel-shut.png" });
  await quiz.getByRole("button", { name: /Quiz/ }).click();
  await expect(quiz.getByText("1. Capital of Australia?")).toBeVisible();
  await quiz.getByRole("button", { name: /Quiz/ }).click();
  await expect(page.getByText("Capital of Australia?")).toHaveCount(0);
  await page.screenshot({ path: "test-results/host-panel-opened.png" });
});
