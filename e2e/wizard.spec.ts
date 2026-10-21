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

  // Summary shows the choices.
  await expect(page.getByText("Quiz, Hot takes")).toBeVisible();
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

  expect(bodies).toEqual([
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party: {},
    },
    {
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party: {},
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
