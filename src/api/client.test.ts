import { beforeEach, describe, expect, it, vi } from "vitest";

// Each test gets a fresh module, so the cached client does not leak between tests.
beforeEach(() => {
  vi.resetModules();
});

describe("getSupabase", () => {
  it("can be imported without any settings", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    await expect(import("./client")).resolves.toBeDefined();
  });

  it("fails on first use when settings are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    const { getSupabase } = await import("./client");

    expect(() => getSupabase()).toThrow(/\.env\.example/);
  });

  it("returns one shared client", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abcdefgh.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");
    const { getSupabase } = await import("./client");

    expect(getSupabase()).toBe(getSupabase());
  });
});
