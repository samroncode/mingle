import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);

test.use({ viewport: { width: 390, height: 844 } });

test("the host picks award categories in the wizard", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  // Afterwork, English, activities (quiz and awards on), the quiz step.
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Award categories" }),
  ).toBeVisible();
  await expect(page.getByText("8 of 20 categories picked")).toBeVisible();

  // Untick the first category and tick another ready-made one.
  const picked = page.locator("ol > li");
  await expect(picked).toHaveCount(8);
  const firstText = await picked.first().locator("p").first().innerText();
  await page
    .getByRole("button", { name: "Remove category 1", exact: true })
    .click();
  await expect(page.getByText("7 of 20 categories picked")).toBeVisible();
  const more = page.getByRole("region", { name: "More ready-made categories" });
  await expect(more.getByText(firstText, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: `Add the category: ${firstText}` })
    .click();
  await expect(page.getByText("8 of 20 categories picked")).toBeVisible();

  // An empty category of the host's own blocks Next with a message.
  await page.getByRole("button", { name: "Add your own category" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Category 9 needs a text",
  );
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Text of category 9").fill("Most likely to bake");
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Move it to the top, so the order is the host's.
  for (let i = 0; i < 8; i++) {
    await page
      .getByRole("button", { name: `Move category ${9 - i} up` })
      .click();
  }
  await expect(page.getByLabel("Text of category 1")).toHaveValue(
    "Most likely to bake",
  );

  // The picks survive a reload, without a new random pick.
  await page.reload();
  await expect(page.getByLabel("Text of category 1")).toHaveValue(
    "Most likely to bake",
  );
  await expect(page.getByText("9 of 20 categories picked")).toBeVisible();
  await expect(picked.last()).toContainText(firstText);

  // Skip the rest and create.
  for (let i = 0; i < 6; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByText("9 categories")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  const body = bodies[0] as { awards: { text: string }[] };
  expect(body.awards).toHaveLength(9);
  expect(body.awards[0]).toEqual({ text: "Most likely to bake" });
  expect(body.awards[8]).toEqual({ text: firstText });
});

test("skipping the awards step keeps the eight picked", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(page.getByText("8 of 20 categories picked")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
  // The hot takes step follows; leave it as it is.
  await expect(
    page.getByRole("heading", { name: "Hot takes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome text" }),
  ).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect((bodies[0] as { awards: unknown[] }).awards).toHaveLength(8);
});

test("the awards step is left out when awards are switched off", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("switch", { name: "Awards" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  // The hot takes step follows; leave it as it is.
  await expect(
    page.getByRole("heading", { name: "Hot takes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome text" }),
  ).toBeVisible();

  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);
  expect(bodies[0]).not.toHaveProperty("awards");
});

test("the control panel lists the award categories before awards start", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["awards"],
    awards: ["Most likely to dance", "Most likely to bake"],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("awards-host");
  await expect(panel.getByText("1. Most likely to dance")).toBeVisible();
  await expect(panel.getByText("2. Most likely to bake")).toBeVisible();
});

test("the control panel says when the awards have no categories", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: ["awards"] });

  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByTestId("awards-host")).toContainText(
    "There are no categories in these awards yet.",
  );
});

test("the host starts awards and sees the category and the next move", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [409, { error: "module_empty" }],
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["awards"],
    awards: ["Most likely to dance"],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("awards-host");
  await panel.getByRole("button", { name: "Start awards" }).click();

  await expect(panel.getByRole("alert")).toBeVisible();
  expect(bodies[1]).toEqual({
    action: "set_flow",
    code,
    key,
    move: { type: "start_module", module: "awards" },
  });
});

test("the control panel shows the open category and the Reveal button", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["awards"],
    awards: ["Most likely to dance", "Most likely to bake"],
    flow: {
      status: "live",
      current_module: "awards",
      current_step: 1,
      phase: "open",
    },
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("awards-host");
  await expect(panel.getByTestId("awards-progress")).toHaveText("Award 2 of 2");
  await expect(panel.getByText("Most likely to bake")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Reveal" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Stop" })).toBeVisible();
});
