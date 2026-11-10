import { expect, test } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openActivity } from "./panel.ts";

const code = "ABC234";
const key = "c".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

type Entry = NonNullable<
  Parameters<typeof fakeHostPanel>[1]["wheelEntries"]
>[number];

const guestEntry = (id: string, member: string): Entry => ({
  id,
  kind: "guest",
  member_id: member,
  label: null,
  state: "on",
});

/** Opens the wheel section; each host-actions answer runs one `answers` step. */
async function openPanel(
  page: import("@playwright/test").Page,
  entries: Entry[],
  answers: Array<() => [number, object]>,
) {
  const bodies = await fakeSupabase(page, [() => [200, {}], ...answers]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["wheel"],
    status: "live",
    wheelEntries: entries,
    guests: [
      memberRow({ user_id: anna, display_name: "Anna" }),
      memberRow({ user_id: bertil, display_name: "Bertil" }),
    ],
  });
  await page.goto(`/host/${code}#key=${key}`);
  await openActivity(page, "wheel", "Lucky wheel");
  return bodies;
}

test("everyone is on the wheel at first, and a guest can be ticked off and on", async ({
  page,
}) => {
  const entries: Entry[] = [];
  const bodies = await openPanel(page, entries, [
    () => {
      entries.push(guestEntry("e1", anna), guestEntry("e2", bertil));
      return [200, {}];
    },
    () => {
      entries[0] = { ...guestEntry("e1", anna), state: "off" };
      return [200, {}];
    },
    () => {
      entries[0] = guestEntry("e1", anna);
      return [200, {}];
    },
  ]);
  const section = page.getByTestId("wheel-host");
  const annaBox = section.getByLabel("Anna is on the wheel");

  await expect(annaBox).toBeChecked();
  await expect(section.getByLabel("Bertil is on the wheel")).toBeChecked();
  expect(bodies[1]).toEqual({
    action: "update_wheel",
    code,
    key,
    change: { type: "add_guests", ids: [anna, bertil] },
  });

  await annaBox.click();
  await expect(annaBox).not.toBeChecked();
  await expect(section.getByTestId("wheel-taken-off")).toContainText("Anna");
  expect(bodies[2]).toMatchObject({
    change: { type: "take_off", id: "e1" },
  });

  await annaBox.click();
  await expect(annaBox).toBeChecked();
  await expect(section.getByTestId("wheel-taken-off")).toHaveCount(0);
  expect(bodies[3]).toMatchObject({ change: { type: "put_back", id: "e1" } });
});

test("the host adds an own entry, takes it off and puts it back", async ({
  page,
}) => {
  const entries: Entry[] = [guestEntry("e1", anna)];
  const bodies = await openPanel(page, entries, [
    () => {
      entries.push({
        id: "e3",
        kind: "custom",
        member_id: null,
        label: "Take a shot",
        state: "on",
      });
      return [200, {}];
    },
    () => {
      entries[1] = { ...entries[1], state: "off" };
      return [200, {}];
    },
    () => {
      entries[1] = { ...entries[1], state: "on" };
      return [200, {}];
    },
  ]);
  const section = page.getByTestId("wheel-host");

  await section
    .getByLabel("Write an entry for the wheel")
    .fill("  Take a shot ");
  await expect(section.getByText("14/30")).toBeVisible();
  await section.getByRole("button", { name: "Add entry" }).click();
  await expect(
    section.getByRole("button", { name: "Take Take a shot off the wheel" }),
  ).toBeVisible();
  expect(bodies[1]).toMatchObject({
    change: { type: "add_custom", label: "Take a shot" },
  });

  await section
    .getByRole("button", { name: "Take Take a shot off the wheel" })
    .click();
  const off = section.getByTestId("wheel-taken-off");
  await expect(off).toContainText("Take a shot");
  expect(bodies[2]).toMatchObject({ change: { type: "take_off", id: "e3" } });

  await off
    .getByRole("button", { name: "Put Take a shot back on the wheel" })
    .click();
  await expect(section.getByTestId("wheel-taken-off")).toHaveCount(0);
  expect(bodies[3]).toMatchObject({ change: { type: "put_back", id: "e3" } });
});

test("a suggested entry is added with one tap, and a failure shows a message", async ({
  page,
}) => {
  const bodies = await openPanel(
    page,
    [guestEntry("e1", anna)],
    [() => [409, { error: "too_many" }]],
  );
  const section = page.getByTestId("wheel-host");

  await section
    .getByRole("button", { name: /^Add the entry: / })
    .first()
    .click();
  await expect(
    section.getByText(/The wheel holds at most 24 entries/),
  ).toBeVisible();
  expect(bodies[1]).toMatchObject({ change: { type: "add_custom" } });
  // The list stays as it was.
  await expect(section.getByLabel("Anna is on the wheel")).toBeChecked();
});
