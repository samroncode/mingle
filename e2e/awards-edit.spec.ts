import { expect, test, type Page } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);

async function openPanel(page: Page, updateAnswer: [number, object]) {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => updateAnswer,
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["awards"],
    status: "live",
    awards: ["Most likely to be late", "Most likely to dance on a table"],
  });
  await page.goto(`/host/${code}#key=${key}`);
  await openSection(page, "activity-awards");
  await page.getByRole("button", { name: "Edit categories" }).click();
  return bodies;
}

test("the host edits the award categories in the control panel", async ({
  page,
}) => {
  const bodies = await openPanel(page, [200, {}]);
  const editor = page.getByTestId("awards-edit");

  await expect(editor.getByText("2 of 20 categories picked")).toBeVisible();
  await editor.getByLabel("Text of category 2").fill("Most likely to sing");
  await editor.getByRole("button", { name: "Save categories" }).click();

  await expect(editor).toHaveCount(0);
  expect(bodies[1]).toEqual({
    action: "update_awards",
    code,
    key,
    categories: [
      { text: "Most likely to be late" },
      { text: "Most likely to sing" },
    ],
  });
});

test("the control panel says why an awards edit was refused", async ({
  page,
}) => {
  await openPanel(page, [409, { error: "invalid_transition" }]);

  await page.getByRole("button", { name: "Save categories" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Categories can't be changed while a category is on the TV",
  );
  await expect(page.getByTestId("awards-edit")).toBeVisible();
});
