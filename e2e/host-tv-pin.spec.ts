import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "f".repeat(43);
const party = {
  welcome: "Welcome",
  menu: ["Pizza"],
  wifi: { ssid: "Home", password: "pw" },
};

test("the host locks the TV on a part and goes back to Auto", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, { code, enabledModules: ["quiz"], party });

  await page.goto(`/host/${code}?view=run#key=${key}`);
  const picker = page.getByTestId("tv-screen-picker");
  await expect(picker.getByTestId("tv-pin-auto")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await picker.getByRole("button", { name: "Menu" }).click();
  await expect
    .poll(() => bodies.at(-1))
    .toMatchObject({
      action: "update_party_content",
      party: { welcome: "Welcome", menu: ["Pizza"], tvPin: "menu" },
    });

  await picker.getByTestId("tv-pin-auto").click();
  await expect.poll(() => bodies.length).toBe(3);
  expect(bodies.at(-1)).not.toHaveProperty("party.tvPin");
});
