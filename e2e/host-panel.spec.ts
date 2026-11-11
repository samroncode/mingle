import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);

test("Prepare lists its sections with a count beside each activity", async ({
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

  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  const list = page.getByTestId("prepare-list");
  await expect(list.getByTestId("section-link-quiz")).toContainText(
    "1 question",
  );
  await expect(list.getByTestId("section-link-awards")).toContainText("off");

  // The list is the navigation; one section is open at a time.
  await expect(page.getByText("Welcome!")).toHaveCount(0);
  await page.screenshot({ path: "test-results/host-panel-list.png" });
  await openSection(page, "party-screen");
  await expect(page.getByTestId("party-screen")).toContainText(
    "1 of 5 parts filled in",
  );
  await openSection(page, "host-guests");
  await expect(page.getByTestId("host-guests")).toContainText("1 guest");
  await expect(page.getByText("Anna", { exact: true })).toBeVisible();
  await openSection(page, "activity-quiz");
  await expect(
    page.getByTestId("activity-quiz").getByText("1. Capital of Australia?"),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/host-panel-opened.png" });
});
