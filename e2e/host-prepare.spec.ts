import { expect, test, type Page } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "f".repeat(43);

const guests = [
  memberRow({
    user_id: "00000000-0000-4000-8000-0000000000a1",
    display_name: "Anna",
  }),
];

const phone = (page: Page) => (page.viewportSize()?.width ?? 0) < 1024;

async function setup(page: Page, answers: Parameters<typeof fakeSupabase>[1]) {
  const bodies = await fakeSupabase(page, answers);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["quiz"],
    quiz: [
      {
        id: "q1",
        position: 1,
        text: "Capital of Australia?",
        options: ["Sydney", "Melbourne", "Canberra", "Perth"],
        correct: 2,
      },
    ],
    guests,
  });
  return bodies;
}

test("the list has three groups, with a count beside each activity or off", async ({
  page,
}) => {
  await setup(page, [() => [200, {}]]);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  const list = page.getByRole("navigation", { name: "Sections" });
  for (const group of ["Activities", "The evening", "Event"]) {
    await expect(list.getByRole("heading", { name: group })).toBeVisible();
  }
  await expect(list.getByTestId("section-link-quiz")).toContainText(
    "1 question",
  );
  await expect(list.getByTestId("section-link-awards")).toContainText("off");
  for (const section of [
    "party",
    "program",
    "costs",
    "guests",
    "messages",
    "winners",
    "links",
    "brightroom",
    "end",
  ]) {
    await expect(list.getByTestId(`section-link-${section}`)).toBeVisible();
  }
});

test("choosing a section opens its editor and puts it in the URL", async ({
  page,
}) => {
  await setup(page, [() => [200, {}], () => [200, {}]]);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  const wide = !phone(page);
  if (wide) {
    // The first section is open beside the list.
    await expect(page.getByTestId("activity-quiz")).toBeVisible();
  } else {
    await expect(page.getByTestId("prepare-editor")).toHaveCount(0);
  }

  await page.getByTestId("section-link-guests").click();
  await expect(page.getByTestId("host-guests").getByText("Anna")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("section")).toBe("guests");
  expect(new URL(page.url()).hash).toBe(`#key=${key}`);
  if (wide) {
    await expect(page.getByTestId("section-link-guests")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("section-link-quiz")).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("prepare-list")).toBeVisible();
  }
  await page.reload();
  await expect(page.getByTestId("host-guests").getByText("Anna")).toBeVisible();
});

test("on a phone a section is its own page with a back link", async ({
  page,
}) => {
  test.skip(!phone(page), "the phone layout only");
  await setup(page, [() => [200, {}]]);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  await page.getByTestId("section-link-guests").click();
  await expect(page.getByTestId("prepare-list")).toHaveCount(0);
  const back = page.getByTestId("prepare-back");
  expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await back.click();
  await expect(page.getByTestId("prepare-list")).toBeVisible();
  await expect(page.getByTestId("prepare-editor")).toHaveCount(0);

  // The browser's back button also returns to the list.
  await page.getByTestId("section-link-guests").click();
  await expect(page.getByTestId("prepare-editor")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("prepare-list")).toBeVisible();
});

test("the list is reachable by keyboard", async ({ page }) => {
  await setup(page, [() => [200, {}]]);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  const link = page.getByTestId("section-link-messages");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("host-messages")).toBeVisible();
});

test("switching an off activity on sends the same action and its count appears", async ({
  page,
}) => {
  const bodies = await setup(page, [() => [200, {}], () => [200, {}]]);
  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  await page.getByTestId("section-link-awards").click();
  const awards = page.getByTestId("activity-awards");
  await expect(awards.getByRole("heading", { name: "Awards" })).toBeVisible();
  await expect(awards).toContainText("Vote on who is most likely");
  const use = awards.getByRole("switch", { name: "Use this activity" });
  await expect(use).not.toBeChecked();
  await use.click();
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
  expect(bodies[1]).toEqual({
    action: "set_modules",
    code,
    key,
    modules: ["quiz", "awards"],
  });
});
