import { expect, test } from "@playwright/test";
import { fakeSupabase } from "./fake-supabase.ts";

const code = "ABC234";
const key = "a".repeat(43);

test("creates an event through the wizard", async ({ page }) => {
  const bodies = await fakeSupabase(page, [
    () => [429, { error: "rate_limited" }],
    () => [200, { code, key }],
    () => [200, {}],
  ]);

  await page.goto("/");
  await page.getByRole("link", { name: "Create an event" }).click();

  // Niche, then language (starts on the UI language), then activities.
  await expect(page.getByRole("button", { name: /Afterwork/ })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("main").getByRole("button", { name: "English" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("main").getByRole("button", { name: "Svenska" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("switch", { name: "Awards" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // The quiz step starts with ten of the niche's questions; skip the edits.
  await expect(
    page.getByRole("heading", { name: "Quiz questions" }),
  ).toBeVisible();
  await expect(page.getByText("10 of 30 questions picked")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  // Welcome text is prefilled in the event language (Swedish); edit it.
  const welcome = page.getByLabel("Shown on the TV when guests arrive");
  await expect(welcome).not.toHaveValue("");
  await welcome.fill("Välkomna hem till mig!");
  await page.getByRole("button", { name: "Next" }).click();

  // A reload keeps the step and what was typed.
  await page.getByRole("button", { name: "Back" }).click();
  await page.reload();
  await expect(
    page.getByLabel("Shown on the TV when guests arrive"),
  ).toHaveValue("Välkomna hem till mig!");
  await page.getByRole("button", { name: "Next" }).click();

  // Menu: add two lines, reorder, remove an empty one.
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Menu line 1").fill("Pizza");
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Menu line 2").fill("Tårta");
  await page.getByRole("button", { name: "Move line 2 up" }).click();
  await expect(page.getByLabel("Menu line 1")).toHaveValue("Tårta");
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByRole("button", { name: "Remove line 3" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // Schedule: one line with a time and a title.
  await page.getByRole("button", { name: "Add a line" }).click();
  await page.getByLabel("Time for line 1").fill("19:30");
  await page.getByLabel("Title for line 1").fill("Middag");
  await page.getByRole("button", { name: "Next" }).click();

  // Wifi and music: a bad link blocks Next until fixed.
  await page.getByLabel("Wifi name").fill("HomeNet");
  await page.getByLabel("Music link").fill("http://open.spotify.com/jam/x");
  await expect(page.getByRole("alert")).toContainText("valid https link");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await page.getByLabel("Music link").fill("https://open.spotify.com/jam/x");
  await page.getByRole("button", { name: "Next" }).click();

  // Summary shows the choices.
  await expect(page.getByText("Quiz, Hot takes")).toBeVisible();
  await expect(page.getByText("Tårta, Pizza")).toBeVisible();
  await expect(
    page.getByRole("definition").filter({ hasText: "Svenska" }),
  ).toBeVisible();

  // A failed create keeps the input and shows a plain message.
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("alert")).toContainText("Too many tries");
  await expect(page.getByText("Quiz, Hot takes")).toBeVisible();

  // The retry succeeds.
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  const party = {
    welcome: "Välkomna hem till mig!",
    menu: ["Tårta", "Pizza"],
    schedule: [{ time: "19:30", title: "Middag" }],
    wifi: { ssid: "HomeNet", password: "" },
    musicUrl: "https://open.spotify.com/jam/x",
  };
  expect(bodies).toEqual([
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party,
      quiz: expect.any(Array),
    },
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party,
      quiz: expect.any(Array),
    },
  ]);

  const origin = new URL(page.url()).origin;
  await expect(page.getByTestId("host-link")).toHaveText(
    `${origin}/host/${code}#key=${key}`,
  );
  await expect(page.getByTestId("tv-address")).toHaveText(
    `${origin}/tv/${code}`,
  );
  await expect(page.getByRole("alert")).toContainText("can't be shown again");

  await page.getByRole("link", { name: "Open the control panel" }).click();
  await expect(page).toHaveURL(`${origin}/host/${code}#key=${key}`);
  // The control panel claims the event and shows the code and TV address; the
  // host link stays hidden until the host taps to show it.
  await expect(page.getByTestId("event-code")).toHaveText(code);
  await expect(page.getByTestId("tv-address")).toHaveText(
    `${origin}/tv/${code}`,
  );
  await expect(page.getByTestId("host-link")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(key);
  await expect(
    page.getByRole("button", { name: "Copy host link" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show host link" }).click();
  await expect(page.getByTestId("host-link")).toHaveText(
    `${origin}/host/${code}#key=${key}`,
  );
  expect(bodies.at(-1)).toEqual({ action: "claim_host", code, key });

  // The draft is gone once the event exists: a new wizard starts fresh.
  await page.goto("/new");
  await expect(page.getByRole("button", { name: /Afterwork/ })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(
    page.getByRole("main").getByRole("button", { name: "English" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("remembers the created event under Your events", async ({ page }) => {
  await fakeSupabase(page, [() => [200, { code, key }]]);

  await page.goto("/");
  await expect(page.getByText("Your events")).toBeHidden();
  await page.getByRole("link", { name: "Create an event" }).click();
  for (let i = 0; i < 9; i++) {
    await page
      .getByRole("button", { name: /Next|Skip/ })
      .first()
      .click();
  }
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByTestId("event-code")).toHaveText(code);

  await page.goto("/");
  const section = page.getByRole("region", { name: "Your events" });
  await expect(section).toContainText(code);
  await expect(section).toContainText("Afterwork");
  await section.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/host\/ABC234#key=/);

  await page.goto("/");
  await page.getByRole("button", { name: `Forget event ${code}` }).click();
  await expect(page.getByText("Your events")).toBeHidden();
  await page.reload();
  await expect(page.getByText("Your events")).toBeHidden();
});

test("stops adding menu lines at the party screen's limit", async ({
  page,
}) => {
  await page.goto("/new");
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  const add = page.getByRole("button", { name: "Add a line" });
  for (let i = 0; i < 20; i++) await add.click();
  await expect(page.getByLabel("Menu line 20")).toBeVisible();
  await expect(add).toBeDisabled();
});

test("Create sends the host to an invalid step instead of sending", async ({
  page,
}) => {
  const bodies = await fakeSupabase(page, []);
  await page.addInitScript(() => {
    localStorage.setItem(
      "mingle.wizard-draft",
      JSON.stringify({
        step: "summary",
        niche: "aw",
        language: "en",
        enabledModules: [],
        party: {
          welcome: "Hi",
          welcomeEdited: true,
          menu: [],
          schedule: [],
          wifiSsid: "",
          wifiPassword: "",
          musicUrl: "http://not-https.example",
        },
      }),
    );
  });
  await page.goto("/new");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.getByRole("alert")).toContainText("valid https link");
  await expect(page.getByLabel("Music link")).toBeVisible();
  expect(bodies).toEqual([]);
});
