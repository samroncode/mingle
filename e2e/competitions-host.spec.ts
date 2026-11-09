import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);

type Row = { id: string; name: string };

/** Opens the competitions section; each host-actions answer runs `change`. */
async function openPanel(
  page: import("@playwright/test").Page,
  list: Row[],
  answers: Array<() => [number, object]>,
) {
  const bodies = await fakeSupabase(page, [() => [200, {}], ...answers]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["competitions"],
    status: "live",
    competitions: list,
  });
  await page.goto(`/host/${code}#key=${key}`);
  await openSection(page, "activity-competitions");
  return bodies;
}

test("the host adds and removes a competition in the control panel", async ({
  page,
}) => {
  const list: Row[] = [{ id: "c1", name: "Ping pong" }];
  const bodies = await openPanel(page, list, [
    () => {
      list.push({ id: "c2", name: "Darts" });
      return [200, {}];
    },
    () => {
      list.splice(0, 1);
      return [200, {}];
    },
  ]);
  const section = page.getByTestId("competitions-host");

  await expect(section.getByText("Ping pong")).toBeVisible();

  await section.getByLabel("Name of the new competition").fill("  Darts ");
  await section.getByRole("button", { name: "Add competition" }).click();
  await expect(section.getByText("Darts")).toBeVisible();
  expect(bodies[1]).toEqual({
    action: "update_competitions",
    code,
    key,
    change: { type: "add", name: "Darts" },
  });

  await section.getByRole("button", { name: "Remove Ping pong" }).click();
  await expect(
    section.getByText(/Remove Ping pong\? Its matches go with it/),
  ).toBeVisible();
  await section.getByRole("button", { name: "Remove competition" }).click();

  await expect(section.getByText("Ping pong")).toHaveCount(0);
  await expect(section.getByText("Darts")).toBeVisible();
  expect(bodies[2]).toEqual({
    action: "update_competitions",
    code,
    key,
    change: { type: "remove", id: "c1" },
  });
});

test("cancelling the remove confirmation sends nothing", async ({ page }) => {
  const bodies = await openPanel(page, [{ id: "c1", name: "Ping pong" }], []);
  const section = page.getByTestId("competitions-host");

  await section.getByRole("button", { name: "Remove Ping pong" }).click();
  await section.getByRole("button", { name: "Cancel" }).click();

  await expect(section.getByText("Ping pong")).toBeVisible();
  expect(bodies).toHaveLength(1);
});

test("the host renames a competition", async ({ page }) => {
  const list: Row[] = [{ id: "c1", name: "Ping pong" }];
  const bodies = await openPanel(page, list, [
    () => {
      list[0] = { id: "c1", name: "Table tennis" };
      return [200, {}];
    },
  ]);
  const section = page.getByTestId("competitions-host");

  await section.getByRole("button", { name: "Rename Ping pong" }).click();
  await section.getByLabel("New name for Ping pong").fill("Table tennis");
  await section.getByRole("button", { name: "Save" }).click();

  await expect(section.getByText("Table tennis")).toBeVisible();
  expect(bodies[1]).toEqual({
    action: "update_competitions",
    code,
    key,
    change: { type: "rename", id: "c1", name: "Table tennis" },
  });
});

test("the panel says why a sixth competition was refused", async ({ page }) => {
  await openPanel(
    page,
    [{ id: "c1", name: "Ping pong" }],
    [() => [409, { error: "too_many" }]],
  );
  const section = page.getByTestId("competitions-host");

  await section.getByLabel("Name of the new competition").fill("Kubb");
  await section.getByRole("button", { name: "Add competition" }).click();

  await expect(page.getByRole("alert")).toContainText("at most 5 competitions");
  await expect(section.getByLabel("Name of the new competition")).toHaveValue(
    "Kubb",
  );
});

test("a failed change shows a try-again message and keeps the list", async ({
  page,
}) => {
  await openPanel(
    page,
    [{ id: "c1", name: "Ping pong" }],
    [() => [500, { error: "internal_error" }]],
  );
  const section = page.getByTestId("competitions-host");

  await section.getByLabel("Name of the new competition").fill("Kubb");
  await section.getByRole("button", { name: "Add competition" }).click();

  await expect(page.getByRole("alert")).toContainText("Something went wrong");
  await expect(section.getByText("Ping pong")).toBeVisible();
});
