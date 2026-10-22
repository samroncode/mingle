import { expect, test } from "@playwright/test";
import { fakeEvent, fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";

test("a guest opens the join page, joins with a name and is in", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  const names = await fakeEvent(page, { code, joinAnswers: ["ok"] });

  await page.goto(`/p/${code}`);
  await page.getByLabel("Your name").fill("Anna");
  await page.getByRole("button", { name: "Join" }).click();

  await expect(
    page.getByRole("heading", { name: "You're in, Anna!" }),
  ).toBeVisible();
  expect(names).toEqual(["Anna"]);
});

test("a taken name shows its message and can be replaced", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinAnswers: ["name_taken", "ok"] });

  await page.goto(`/p/${code}`);
  await page.getByLabel("Your name").fill("Anna");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByRole("alert")).toContainText("That name is taken");

  await page.getByLabel("Your name").fill("Anna B");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(
    page.getByRole("heading", { name: "You're in, Anna B!" }),
  ).toBeVisible();
});

test("a guest who is already in goes straight to the page and can rename", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, { code, joinedAs: "Anna" });

  await page.goto(`/p/${code}`);
  await expect(
    page.getByRole("heading", { name: "You're in, Anna!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Change my name" }).click();
  await page.getByLabel("New name").fill("Annika");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("button", { name: "Change my name" }),
  ).toBeVisible();
});

test("a guest sees the evening's info after joining", async ({ page }) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, {
    code,
    joinedAs: "Anna",
    party: {
      welcome: "Welcome <b>friends</b>",
      menu: ["Tacos", "Nachos"],
      schedule: [{ time: "19:00", title: "Dinner" }],
      wifi: { ssid: "PartyNet", password: "secret123" },
      musicUrl: "https://open.spotify.com/jam/abc",
    },
  });

  await page.goto(`/p/${code}`);
  await expect(page.getByText("Welcome <b>friends</b>")).toBeVisible();
  await expect(page.getByText("Tacos")).toBeVisible();
  await expect(page.getByText("19:00")).toBeVisible();
  await expect(page.getByText("PartyNet")).toBeVisible();
  await expect(page.getByText("secret123")).toBeVisible();
  const music = page.getByRole("link", { name: "Open music" });
  await expect(music).toHaveAttribute("target", "_blank");
  await expect(music).toHaveAttribute("rel", "noopener noreferrer");
});

test("parts the host left out are not shown, and an open network says so", async ({
  page,
}) => {
  await fakeSupabase(page, []);
  await fakeEvent(page, {
    code,
    joinedAs: "Anna",
    party: { wifi: { ssid: "OpenNet", password: "" } },
  });

  await page.goto(`/p/${code}`);
  await expect(page.getByText("OpenNet")).toBeVisible();
  await expect(page.getByText("Open network")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Menu" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Open music" })).toHaveCount(0);
});
