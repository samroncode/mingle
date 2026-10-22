import { describe, expect, it, vi } from "vitest";
import { ensureAnonymousSession, type AppClient } from "./session";

/** A client with just the auth calls the session code makes. */
function fakeClient(options: {
  session?: boolean;
  signInError?: { code?: string };
}) {
  const signInAnonymously = vi.fn(() =>
    Promise.resolve(
      options.signInError
        ? { data: { user: null }, error: options.signInError }
        : { data: { user: { id: "new-user" } }, error: null },
    ),
  );
  const client = {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: {
            session: options.session ? { user: { id: "old-user" } } : null,
          },
        }),
      signInAnonymously,
    },
  } as unknown as AppClient;
  return { client, signInAnonymously };
}

describe("ensureAnonymousSession", () => {
  it("signs in without a token when no site key is set", async () => {
    const { client, signInAnonymously } = fakeClient({});
    const getToken = vi.fn();

    const result = await ensureAnonymousSession(client, { getToken });

    expect(result).toEqual({ ok: true, value: "new-user" });
    expect(getToken).not.toHaveBeenCalled();
    expect(signInAnonymously).toHaveBeenCalledWith(undefined);
  });

  it("passes the CAPTCHA token to sign-in when a site key is set", async () => {
    const { client, signInAnonymously } = fakeClient({});
    const getToken = vi.fn(() => Promise.resolve("token-1"));

    const result = await ensureAnonymousSession(client, {
      siteKey: "site-key",
      getToken,
    });

    expect(result).toEqual({ ok: true, value: "new-user" });
    expect(getToken).toHaveBeenCalledWith("site-key");
    expect(signInAnonymously).toHaveBeenCalledWith({
      options: { captchaToken: "token-1" },
    });
  });

  it("returns captcha_failed and does not sign in when the check fails", async () => {
    const { client, signInAnonymously } = fakeClient({});
    const getToken = vi.fn(() => Promise.reject(new Error("failed")));

    const result = await ensureAnonymousSession(client, {
      siteKey: "site-key",
      getToken,
    });

    expect(result).toEqual({ ok: false, error: "captcha_failed" });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("returns captcha_failed when the server refuses the token", async () => {
    const { client } = fakeClient({ signInError: { code: "captcha_failed" } });

    const result = await ensureAnonymousSession(client, {
      siteKey: "site-key",
      getToken: () => Promise.resolve("expired"),
    });

    expect(result).toEqual({ ok: false, error: "captcha_failed" });
  });

  it("returns sign_in_failed for any other sign-in error", async () => {
    const { client } = fakeClient({
      signInError: { code: "over_request_rate_limit" },
    });

    const result = await ensureAnonymousSession(client);

    expect(result).toEqual({ ok: false, error: "sign_in_failed" });
  });

  it("asks for no token when the device already has a session", async () => {
    const { client, signInAnonymously } = fakeClient({ session: true });
    const getToken = vi.fn();

    const result = await ensureAnonymousSession(client, {
      siteKey: "site-key",
      getToken,
    });

    expect(result).toEqual({ ok: true, value: "old-user" });
    expect(getToken).not.toHaveBeenCalled();
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("shares one CAPTCHA and one sign-in between simultaneous callers", async () => {
    const { client, signInAnonymously } = fakeClient({});
    const getToken = vi.fn(() => Promise.resolve("token-1"));
    const options = { siteKey: "site-key", getToken };

    const results = await Promise.all([
      ensureAnonymousSession(client, options),
      ensureAnonymousSession(client, options),
    ]);

    expect(results[0]).toEqual(results[1]);
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
