import { expect, test, type Page } from "@playwright/test";
import { memberRow } from "./fake-rows.ts";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openPrepare } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);
const anna = "00000000-0000-4000-8000-0000000000a1";
const bertil = "00000000-0000-4000-8000-0000000000b2";

type Options = Parameters<typeof fakeHostPanel>[1];
type Entry = NonNullable<Options["wheelEntries"]>[number];
type Spin = NonNullable<Options["wheelSpins"]>[number];

const guestEntry = (id: string, member: string): Entry => ({
  id,
  kind: "guest",
  member_id: member,
  label: null,
  state: "on",
});

const custom = (id: string, label: string): Entry => ({
  id,
  kind: "custom",
  member_id: null,
  label,
  state: "on",
});

/** Opens the panel with the wheel running; each answer is one host action. */
async function openRunning(
  page: Page,
  entries: Entry[],
  spins: Spin[],
  answers: Array<() => [number, object]>,
) {
  const bodies = await fakeSupabase(page, [() => [200, {}], ...answers]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["wheel"],
    status: "live",
    flow: { current_module: "wheel", current_step: 0, phase: "idle" },
    wheelEntries: entries,
    wheelSpins: spins,
    guests: [
      memberRow({ user_id: anna, display_name: "Anna" }),
      memberRow({ user_id: bertil, display_name: "Bertil" }),
    ],
  });
  await page.goto(`/host/${code}#key=${key}`);
  return bodies;
}

test("the host spins twice, takes the second result off and it leaves the list", async ({
  page,
}) => {
  const entries = [guestEntry("e1", anna), guestEntry("e2", bertil)];
  const spins: Spin[] = [];
  const bodies = await openRunning(page, entries, spins, [
    () => {
      spins.push({ id: "s1", entry_id: "e1", label: "Anna" });
      return [200, {}];
    },
    () => {
      spins.push({ id: "s2", entry_id: "e2", label: "Bertil" });
      return [200, {}];
    },
    () => {
      entries[1] = { ...entries[1], state: "off" };
      return [200, {}];
    },
  ]);
  const live = page;
  const spin = live.getByRole("button", { name: "Spin", exact: true });

  await expect(live.getByTestId("wheel-no-result")).toBeVisible();
  await spin.click();
  await expect(live.getByTestId("wheel-result")).toContainText("Anna");
  // The button is busy while the TV and phones animate.
  await expect(live.getByRole("button", { name: "Spinning…" })).toBeDisabled();
  await expect(spin).toBeEnabled({ timeout: 9000 });
  await spin.click();
  await expect(live.getByTestId("wheel-result")).toContainText("Bertil");
  expect(bodies[1]).toEqual({ action: "spin_wheel", code, key });
  await expect(live.getByTestId("wheel-spins")).toContainText("2.Bertil");

  await live.getByRole("button", { name: "Take off the wheel" }).click();
  expect(bodies[3]).toMatchObject({
    action: "update_wheel",
    change: { type: "take_off", id: "e2" },
  });
  await expect(
    live.getByRole("button", { name: "Take off the wheel" }),
  ).toHaveCount(0);
  // Taken off: it has left the wheel (the activity's summary, in Prepare, counts it).
  await openPrepare(page);
  await expect(
    page.getByRole("button", { name: /1 entry on the wheel, 2 spins/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/wheel-host-live.png" });
});

test("Spin says why it is disabled with fewer than two entries", async ({
  page,
}) => {
  await openRunning(page, [custom("e1", "Take a shot")], [], []);
  const live = page;

  await expect(
    live.getByRole("button", { name: "Spin", exact: true }),
  ).toBeDisabled();
  await expect(live.getByTestId("wheel-spin-reason")).toContainText(
    "at least two entries",
  );
});

test("a failed spin shows a message and changes nothing", async ({ page }) => {
  const bodies = await openRunning(
    page,
    [guestEntry("e1", anna), guestEntry("e2", bertil)],
    [],
    [() => [429, { error: "rate_limited" }]],
  );
  const live = page;

  await live.getByRole("button", { name: "Spin", exact: true }).click();
  await expect(live.getByRole("alert")).toBeVisible();
  expect(bodies[1]).toMatchObject({ action: "spin_wheel" });
  await expect(live.getByTestId("wheel-no-result")).toBeVisible();
  await expect(
    live.getByRole("button", { name: "Spin", exact: true }),
  ).toBeEnabled();
});

test("the automatic take-off switch and Clear list send their actions", async ({
  page,
}) => {
  const spins: Spin[] = [{ id: "s1", entry_id: "e1", label: "Anna" }];
  const bodies = await openRunning(
    page,
    [guestEntry("e1", anna), guestEntry("e2", bertil)],
    spins,
    [
      () => [200, {}],
      () => {
        spins.length = 0;
        return [200, {}];
      },
    ],
  );
  const live = page;

  await live
    .getByRole("switch", { name: "Take drawn entries off automatically" })
    .click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({
    action: "set_wheel_auto_take_off",
    code,
    key,
    enabled: true,
  });

  await live.getByRole("button", { name: "Clear list" }).click();
  await expect(live.getByTestId("wheel-no-result")).toBeVisible();
  expect(bodies[2]).toEqual({ action: "clear_wheel_spins", code, key });
});

test("an idle wheel has a Start button that starts it", async ({ page }) => {
  const bodies = await fakeSupabase(page, [
    () => [200, {}],
    () => [200, { ok: true }],
  ]);
  await fakeHostPanel(page, {
    code,
    enabledModules: ["wheel"],
    status: "live",
    flow: { current_module: null, current_step: 0, phase: "idle" },
    guests: [memberRow({ user_id: anna, display_name: "Anna" })],
  });
  await page.goto(`/host/${code}#key=${key}`);
  await page
    .getByTestId("activity-wheel")
    .getByText("Lucky wheel")
    .first()
    .click();
  await page.getByRole("button", { name: "Start the wheel" }).click();
  await expect.poll(() => JSON.stringify(bodies)).toContain('"start_module"');
});
