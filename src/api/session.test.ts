import { describe, expect, it, vi } from "vitest";
import { ensureAnonymousSession, type AppClient } from "./session";

function clientWith(auth: Record<string, unknown>) {
  return { auth } as unknown as AppClient;
}

const signedIn = (id: string) =>
  vi.fn().mockResolvedValue({ data: { user: { id } }, error: null });

describe("ensureAnonymousSession", () => {
  it("returns the stored session's user without signing in", async () => {
    const signInAnonymously = vi.fn();
    const client = clientWith({
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "old" } } },
        error: null,
      }),
      signInAnonymously,
    });
    expect(await ensureAnonymousSession(client)).toBe("old");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("signs in again when the stored login was deleted and can't refresh", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = clientWith({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid Refresh Token: user not found" },
      }),
      signOut,
      signInAnonymously: signedIn("new"),
    });
    expect(await ensureAnonymousSession(client)).toBe("new");
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("signs in when nothing is stored", async () => {
    const client = clientWith({
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInAnonymously: signedIn("new"),
    });
    expect(await ensureAnonymousSession(client)).toBe("new");
  });
});
