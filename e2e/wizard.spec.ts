import { expect, test, type Page, type Route } from "@playwright/test";

const supabase = "http://localhost:54399";
const code = "ABC234";
const key = "a".repeat(43);

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};

function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...cors, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** An unsigned token: the client stores it and never verifies it. */
function fakeToken() {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: "none" })}.${encode({ sub: "u1", exp, role: "authenticated" })}.x`;
}

/** Fakes anonymous sign-in and host-actions; returns the bodies host-actions got. */
async function fakeSupabase(
  page: Page,
  answers: Array<() => [number, unknown]>,
) {
  const bodies: unknown[] = [];
  await page.route(`${supabase}/auth/v1/**`, (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }
    const user = { id: "u1", aud: "authenticated", is_anonymous: true };
    return json(route, 200, {
      access_token: fakeToken(),
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: "r",
      user,
    });
  });
  await page.route(`${supabase}/functions/v1/host-actions`, (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: cors });
    }
    bodies.push(route.request().postDataJSON());
    const answer = answers.shift();
    const [status, body] = answer
      ? answer()
      : [500, { error: "internal_error" }];
    return json(route, status, body);
  });
  return bodies;
}

test("creates an event through the wizard", async ({ page }) => {
  const bodies = await fakeSupabase(page, [
    () => [429, { error: "rate_limited" }],
    () => [200, { code, key }],
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

  // Welcome text is prefilled in the event language (Swedish); edit it.
  const welcome = page.getByLabel("Shown on the TV when guests arrive");
  await expect(welcome).not.toHaveValue("");
  await welcome.fill("Välkomna hem till mig!");
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
    },
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party,
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
});
