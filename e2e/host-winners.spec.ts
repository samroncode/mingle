import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);
const party = {
  welcome: "Welcome",
  winners: [{ title: "Dart tournament", name: "Anna" }],
};

test("the host adds a winner and hides the slide; the party fields stay", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [200, {}],
    () => [200, {}],
  ]);
  await fakeHostPanel(page, { code, enabledModules: [], party });

  await page.goto(`/host/${code}#key=${key}`);
  const section = page.getByTestId("host-winners");
  await expect(section.getByText("1 winner")).toBeVisible();
  await openSection(page, "host-winners");
  await expect(section.getByText("Anna")).toBeVisible();

  await section.getByRole("button", { name: "Add winner" }).click();
  await expect(section.getByText(/What they won|Enter what/)).toBeVisible();
  expect(bodies).toHaveLength(1);

  await section.getByLabel("What they won").fill("Best costume");
  await section.getByLabel("Winner", { exact: true }).fill("Bo");
  await section.getByRole("button", { name: "Add winner" }).click();
  await expect(section.getByLabel("What they won")).toHaveValue("");
  expect(bodies.at(-1)).toMatchObject({
    action: "update_party_content",
    party: {
      welcome: "Welcome",
      winners: [
        { title: "Dart tournament", name: "Anna" },
        { title: "Best costume", name: "Bo" },
      ],
    },
  });

  await section.getByRole("button", { name: "Hide winners slide" }).click();
  expect(bodies.at(-1)).toMatchObject({
    party: { welcome: "Welcome", winnersHidden: true },
  });
});

test("the winners section is gone once the evening has ended", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    status: "ended",
    party,
  });
  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByText("The evening has ended")).toBeVisible();
  await expect(page.getByTestId("host-winners")).toHaveCount(0);
});
