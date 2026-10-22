import { describe, expect, it } from "vitest";
import { parseSupabaseEnv, parseTurnstileSiteKey } from "./env";

const validEnv = {
  VITE_SUPABASE_URL: "https://abcdefgh.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

/** Builds an unsigned JWT-shaped key with the given claims. */
function jwtWithClaims(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

describe("parseSupabaseEnv", () => {
  it("returns the URL and publishable key", () => {
    expect(parseSupabaseEnv(validEnv)).toEqual({
      url: "https://abcdefgh.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("accepts a legacy anon key", () => {
    const anonKey = jwtWithClaims({ role: "anon" });
    expect(
      parseSupabaseEnv({ ...validEnv, VITE_SUPABASE_PUBLISHABLE_KEY: anonKey })
        .publishableKey,
    ).toBe(anonKey);
  });

  it("points to .env.example when settings are missing", () => {
    expect(() => parseSupabaseEnv({})).toThrow(/\.env\.example/);
  });

  it("names every missing setting", () => {
    expect(() => parseSupabaseEnv({})).toThrow(
      /VITE_SUPABASE_URL.*VITE_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("rejects a URL that is not http(s)", () => {
    expect(() =>
      parseSupabaseEnv({ ...validEnv, VITE_SUPABASE_URL: "not a url" }),
    ).toThrow(/VITE_SUPABASE_URL/);
    expect(() =>
      parseSupabaseEnv({
        ...validEnv,
        VITE_SUPABASE_URL: "javascript:alert(1)",
      }),
    ).toThrow(/VITE_SUPABASE_URL/);
  });

  it("rejects a secret key", () => {
    expect(() =>
      parseSupabaseEnv({
        ...validEnv,
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example",
      }),
    ).toThrow(/secret key/);
  });

  it("rejects a legacy service_role key", () => {
    expect(() =>
      parseSupabaseEnv({
        ...validEnv,
        VITE_SUPABASE_PUBLISHABLE_KEY: jwtWithClaims({ role: "service_role" }),
      }),
    ).toThrow(/secret key/);
  });
});

describe("parseTurnstileSiteKey", () => {
  it("returns the site key", () => {
    expect(parseTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: "0x4AAA" })).toBe(
      "0x4AAA",
    );
  });

  it("is undefined when the key is missing or blank", () => {
    expect(parseTurnstileSiteKey({})).toBeUndefined();
    expect(
      parseTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: "" }),
    ).toBeUndefined();
    expect(
      parseTurnstileSiteKey({ VITE_TURNSTILE_SITE_KEY: "  " }),
    ).toBeUndefined();
  });
});
