import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);

test("the host removes a guest after a confirm", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests: [
      memberRow({
        user_id: "00000000-0000-4000-8000-0000000000a1",
        display_name: "Anna",
      }),
      memberRow({
        user_id: "00000000-0000-4000-8000-0000000000b2",
        display_name: "Bertil",
      }),
    ],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const guests = page.getByTestId("host-guests");
  await expect(guests).toContainText("Anna");

  // Cancel sends nothing; confirming sends remove_guest once.
  await guests.getByRole("button", { name: "Remove Anna" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Remove Anna? They can't rejoin from this phone.",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(bodies).toHaveLength(1);

  await guests.getByRole("button", { name: "Remove Anna" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  expect(bodies.at(-1)).toEqual({
    action: "remove_guest",
    code,
    key,
    userId: "00000000-0000-4000-8000-0000000000a1",
  });
});

test("a failed removal shows a plain message", async ({ page }) => {
  await fakeSupabase(page, [
    () => [200, {}],
    () => [404, { error: "not_found" }],
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    guests: [
      memberRow({
        user_id: "00000000-0000-4000-8000-0000000000a1",
        display_name: "Anna",
      }),
    ],
  });

  await page.goto(`/host/${code}#key=${key}`);
  await page.getByRole("button", { name: "Remove Anna" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove" })
    .click();

  await expect(page.getByRole("alertdialog")).toContainText(
    "That guest isn't part of this evening any more.",
  );
});
