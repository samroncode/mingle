import { expect, test } from "@playwright/test";
import { fakeHostPanel, fakeSupabase } from "./fake-supabase.ts";
import { openSection } from "./panel.ts";

const code = "ABC234";
const key = "d".repeat(43);

test("the host sends a message; empty and too long texts are not sent", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, [() => [200, {}], () => [200, {}]]);
  await fakeHostPanel(page, {
    code,
    enabledModules: [],
    notices: [
      {
        id: "n1",
        text: "Taxi leaves at 01:00",
        createdAt: "2026-10-30T20:00:00Z",
      },
    ],
  });

  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  await openSection(page, "host-messages");
  const section = page.getByTestId("host-messages");
  await expect(section.getByText("1 sent")).toBeVisible();
  await expect(section.getByText("Taxi leaves at 01:00")).toBeVisible();

  const send = section.getByRole("button", { name: "Send" });
  const box = section.getByLabel("Message to all guests");
  await expect(send).toBeDisabled();
  await box.fill("   ");
  await expect(send).toBeDisabled();
  await box.fill("a".repeat(141));
  await expect(section.getByText("-1 character left")).toBeVisible();
  await expect(send).toBeDisabled();

  await box.fill("Dinner is served");
  await expect(section.getByText("124 characters left")).toBeVisible();
  await send.click();
  await expect(box).toHaveValue("");
  expect(bodies.at(-1)).toEqual({
    action: "send_notice",
    code,
    key,
    text: "Dinner is served",
  });
});

test("a message sent too soon shows a plain message and keeps the text", async ({
  page,
}) => {
  await fakeSupabase(page, [
    () => [200, {}],
    () => [429, { error: "too_soon" }],
  ]);
  await fakeHostPanel(page, { code, enabledModules: [] });

  await page.goto(`/host/${code}?view=prepare#key=${key}`);
  await openSection(page, "host-messages");
  const section = page.getByTestId("host-messages");
  await section.getByLabel("Message to all guests").fill("Hello");
  await section.getByRole("button", { name: "Send" }).click();
  await expect(section.getByRole("alert")).toContainText("Wait a few seconds");
  await expect(section.getByLabel("Message to all guests")).toHaveValue(
    "Hello",
  );
});
