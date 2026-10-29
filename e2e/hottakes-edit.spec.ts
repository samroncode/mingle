import { expect, test, type Page } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "c".repeat(43);

async function openPanel(page: Page, updateAnswer: [number, object]) {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => updateAnswer,
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["hottakes"],
    status: "live",
    hottakes: ["Pineapple belongs on pizza", "Karaoke is overrated"],
  });
  await page.goto(`/host/${code}#key=${key}`);
  await page.getByRole("button", { name: "Edit hot takes" }).click();
  return bodies;
}

test("the host edits the hot takes in the control panel", async ({ page }) => {
  const bodies = await openPanel(page, [200, {}]);
  const editor = page.getByTestId("hottakes-edit");

  await expect(editor.getByText("2 of 20 hot takes picked")).toBeVisible();
  await editor.getByLabel("Text of hot take 2").fill("Karaoke is great");
  await editor.getByRole("button", { name: "Save hot takes" }).click();

  await expect(editor).toHaveCount(0);
  expect(bodies[1]).toEqual({
    action: "update_hottakes",
    code,
    key,
    takes: [
      { text: "Pineapple belongs on pizza" },
      { text: "Karaoke is great" },
    ],
  });
});

test("the control panel says why a hot takes edit was refused", async ({
  page,
}) => {
  await openPanel(page, [409, { error: "invalid_transition" }]);

  await page.getByRole("button", { name: "Save hot takes" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Hot takes can't be changed while one is on the TV",
  );
  await expect(page.getByTestId("hottakes-edit")).toBeVisible();
});
