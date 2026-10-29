import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "d".repeat(43);

test.use({ viewport: { width: 390, height: 844 } });

test("the host picks hot takes in the wizard", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  // Afterwork, English, activities, the quiz and awards steps.
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Hot takes", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("8 of 20 hot takes picked")).toBeVisible();

  // Untick the first hot take and tick another ready-made one.
  const picked = page.locator("ol > li");
  await expect(picked).toHaveCount(8);
  const firstText = await picked.first().locator("p").first().innerText();
  await page
    .getByRole("button", { name: "Remove hot take 1", exact: true })
    .click();
  await expect(page.getByText("7 of 20 hot takes picked")).toBeVisible();
  const more = page.getByRole("region", { name: "More ready-made hot takes" });
  await expect(more.getByText(firstText, { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: `Add the hot take: ${firstText}` })
    .click();
  await expect(page.getByText("8 of 20 hot takes picked")).toBeVisible();

  // An empty hot take of the host's own blocks Next with a message.
  await page.getByRole("button", { name: "Add your own hot take" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Hot take 9 needs a text",
  );
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Text of hot take 9")
    .fill("Pineapple belongs on pizza");
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Move it to the top, so the order is the host's.
  for (let i = 0; i < 8; i++) {
    await page
      .getByRole("button", { name: `Move hot take ${9 - i} up` })
      .click();
  }
  await expect(page.getByLabel("Text of hot take 1")).toHaveValue(
    "Pineapple belongs on pizza",
  );

  // The picks survive a reload, without a new random pick.
  await page.reload();
  await expect(page.getByLabel("Text of hot take 1")).toHaveValue(
    "Pineapple belongs on pizza",
  );
  await expect(page.getByText("9 of 20 hot takes picked")).toBeVisible();
  await expect(picked.last()).toContainText(firstText);

  // Skip the rest and create.
  for (let i = 0; i < 5; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await expect(page.getByText("9 hot takes")).toBeVisible();
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  const body = bodies[0] as { hottakes: { text: string }[] };
  expect(body.hottakes).toHaveLength(9);
  expect(body.hottakes[0]).toEqual({ text: "Pineapple belongs on pizza" });
  expect(body.hottakes[8]).toEqual({ text: firstText });
});

test("skipping the hot takes step keeps the eight picked", async ({ page }) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await expect(page.getByText("8 of 20 hot takes picked")).toBeVisible();
  await page.getByRole("button", { name: "Skip" }).click();
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
  expect((bodies[0] as { hottakes: unknown[] }).hottakes).toHaveLength(8);
});

test("the hot takes step is left out when hot takes are switched off", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/new");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("switch", { name: "Hot takes" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
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
  expect(bodies[0]).not.toHaveProperty("hottakes");
});

test("the control panel lists the hot takes before hot takes start", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["hottakes"],
    hottakes: ["Cats beat dogs", "Pineapple belongs on pizza"],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("hottakes-host");
  await expect(panel.getByText("1. Cats beat dogs")).toBeVisible();
  await expect(panel.getByText("2. Pineapple belongs on pizza")).toBeVisible();
});

test("the control panel says when the hot takes have no hot takes", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: ["hottakes"] });

  await page.goto(`/host/${code}#key=${key}`);
  await expect(page.getByTestId("hottakes-host")).toContainText(
    "There are no hot takes yet.",
  );
});

test("the host starts hot takes and sees the error line on a refusal", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [409, { error: "module_empty" }],
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["hottakes"],
    hottakes: ["Cats beat dogs"],
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("hottakes-host");
  await panel.getByRole("button", { name: "Start hot takes" }).click();

  await expect(panel.getByRole("alert")).toBeVisible();
  expect(bodies[1]).toEqual({
    action: "set_flow",
    code,
    key,
    move: { type: "start_module", module: "hottakes" },
  });
});

test("the control panel shows the open hot take and the Reveal button", async ({
  page,
}) => {
  await fakeSupabase(page, [() => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["hottakes"],
    hottakes: ["Cats beat dogs", "Pineapple belongs on pizza"],
    flow: {
      status: "live",
      current_module: "hottakes",
      current_step: 1,
      phase: "open",
    },
  });

  await page.goto(`/host/${code}#key=${key}`);
  const panel = page.getByTestId("hottakes-host");
  await expect(panel.getByTestId("hottakes-progress")).toHaveText(
    "Hot take 2 of 2",
  );
  await expect(panel.getByText("Pineapple belongs on pizza")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Reveal" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Stop" })).toBeVisible();
});
