import type { Page, Route } from "@playwright/test";

export const supabase = "http://localhost:54399";

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

/**
 * Fakes anonymous sign-in and host-actions; returns the bodies host-actions
 * got. Each call takes the next answer; once they run out, it fails with
 * `internal_error`.
 */
export async function fakeSupabase(
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

/** Records the URL of every request the page makes, from now on. */
export function recordRequestUrls(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  return urls;
}
