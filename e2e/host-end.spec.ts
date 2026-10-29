import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);
const ended = {
  status: "ended",
  currentModule: null,
  currentStep: 0,
  phase: "idle",
};

test("the host edits the wifi password and ends the evening", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [200, {}],
    () => [200, ended],
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    party: { wifi: { ssid: "PartyNet", password: "oldpass" } },
  });

  await page.goto(`/host/${code}#key=${key}`);
  await openSection(page, "party-screen");
  await openSection(page, "event-section");
  await expect(page.getByTestId("event-code")).toHaveText(code);

  const party = page.getByTestId("party-screen");
  await party.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel(/password/i).fill("newpass");
  await party.getByRole("button", { name: "Save" }).click();
  await expect(party.getByRole("button", { name: "Edit" })).toBeVisible();

  // Cancel sends nothing; confirming sends end_event once.
  await page.getByRole("button", { name: "End the evening" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Guests can't join or answer any more. This can't be undone.",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(bodies).toHaveLength(2);

  await page.getByRole("button", { name: "End the evening" }).click();
  await page.getByRole("button", { name: "End it now" }).click();
  await expect(page.getByText("The evening has ended")).toBeVisible();
  await expect(party).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "End the evening" }),
  ).toHaveCount(0);

  expect(bodies.at(-1)).toEqual({
    action: "set_flow",
    code,
    key,
    move: { type: "end_event" },
  });
});

test("shows the ended state when the panel opens after the end", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: [], status: "ended" });
  await page.goto(`/host/${code}#key=${key}`);
  await openSection(page, "event-section");
  await expect(page.getByText("The evening has ended")).toBeVisible();
  await expect(page.getByTestId("party-screen")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "End the evening" }),
  ).toHaveCount(0);
});
