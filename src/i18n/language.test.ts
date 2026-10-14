import { describe, expect, it, vi } from "vitest";
import { loadStoredLanguage, resolveLanguage, storeLanguage } from "./language";

describe("resolveLanguage", () => {
  it("prefers the user's stored choice over everything else", () => {
    expect(
      resolveLanguage({
        stored: "en",
        eventLanguage: "sv",
        browserLanguages: ["sv-SE"],
      }),
    ).toBe("en");
  });

  it("uses the event language when there is no stored choice", () => {
    expect(
      resolveLanguage({ eventLanguage: "sv", browserLanguages: ["en-US"] }),
    ).toBe("sv");
  });

  it("uses the first supported browser language when there is no event", () => {
    expect(
      resolveLanguage({ browserLanguages: ["de-DE", "sv-SE", "en-US"] }),
    ).toBe("sv");
  });

  it("falls back to English when nothing is supported", () => {
    expect(resolveLanguage({ browserLanguages: ["de-DE", "fr"] })).toBe("en");
  });

  it("ignores unsupported stored and event values", () => {
    expect(
      resolveLanguage({
        stored: "fr",
        eventLanguage: "xx",
        browserLanguages: ["sv"],
      }),
    ).toBe("sv");
  });
});

describe("stored language", () => {
  it("round-trips through localStorage", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });

    storeLanguage("sv");

    expect(loadStoredLanguage()).toBe("sv");
  });

  it("ignores a stored value that is not a supported language", () => {
    vi.stubGlobal("localStorage", { getItem: () => "fr" });

    expect(loadStoredLanguage()).toBeUndefined();
  });

  it("does not throw when storage is blocked", () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });

    expect(() => storeLanguage("en")).not.toThrow();
    expect(loadStoredLanguage()).toBeUndefined();
  });
});
