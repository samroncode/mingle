import { expect, test, type Page } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "e".repeat(43);

async function openPanel(
  page: Page,
  answers: Array<() => [number, unknown]>,
  panel: { status?: "live"; flow?: { current_module: string } } = {},
) {
  const bodies = await fakeSupabase(page, [() => [200, {}], ...answers]);
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
    ],
    ...panel,
  });
  await page.goto(`/host/${code}#key=${key}`);
  return bodies;
}

test("the host switches an activity on and gets the ready-made list", async ({
  page,
}) => {
  const bodies = await openPanel(page, [() => [200, {}], () => [200, {}]]);

  await page.getByText("Switched off (2)").click();
  await page.screenshot({ path: "test-results/host-activities-off.png" });
  await page.getByRole("switch", { name: "Awards" }).click();

  await expect.poll(() => bodies.length).toBe(3);
  expect(bodies[1]).toEqual({
    action: "set_modules",
    code,
    key,
    modules: ["quiz", "awards"],
  });
  expect(bodies[2]).toMatchObject({ action: "update_awards", code, key });
  const sent = bodies[2] as { categories: unknown[] };
  expect(sent.categories).toHaveLength(8);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("an activity stays on with a plain message when its list can't be added", async ({
  page,
}) => {
  await openPanel(page, [
    () => [200, {}],
    () => [500, { error: "internal_error" }],
  ]);

  await page.getByText("Switched off (2)").click();
  await page.getByRole("switch", { name: "Awards" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Awards is on, but its ready-made list couldn't be added",
  );
});

test("the panel says why a switch was refused", async ({ page }) => {
  await openPanel(page, [() => [409, { error: "invalid_transition" }]]);

  await page.getByText("Switched off (2)").click();
  await page.getByRole("switch", { name: "Hot takes" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
});

test("the running activity can't be switched off", async ({ page }) => {
  await openPanel(page, [], {
    status: "live",
    flow: { current_module: "quiz" },
  });

  const quiz = page.getByTestId("activity-quiz");
  await expect(quiz.getByText("Running")).toBeVisible();
  await expect(
    quiz.getByRole("switch", { name: "Use this activity" }),
  ).toBeDisabled();
  await expect(quiz.getByText("Stop it to switch it off.")).toBeVisible();
  await page.screenshot({ path: "test-results/host-activities-running.png" });
});

test("the host switches the bright room on", async ({ page }) => {
  const bodies = await openPanel(page, [() => [200, {}]]);

  const bright = page.getByRole("switch", { name: "Bright room" });
  await expect(bright).not.toBeChecked();
  await page.getByTestId("bright-room").scrollIntoViewIfNeeded();
  if (process.env.SHOTS) {
    await page
      .getByTestId("bright-room")
      .screenshot({ path: `${process.env.SHOTS}/host-switch.png` });
  }
  await bright.click();

  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({
    action: "set_bright_room",
    code,
    key,
    bright: true,
  });
});
