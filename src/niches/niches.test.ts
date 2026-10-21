import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import sv from "@/i18n/sv.json";
import indexCss from "@/index.css?raw";
import { supportedLanguages } from "@/i18n/language";
import { PartySchema } from "@/lib/schemas/party";
import { nicheIds } from "./ids";
import { isNicheId, niches } from "./index";
import { nicheThemeStyle } from "./theme";
import { NicheConfigSchema, themeTokens } from "./types";

/** Reads a dotted key like "niches.aw.name" from a translation file. */
function translation(locale: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        typeof node === "object" && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      locale,
    );
}

/** Token names declared on `:root` in src/index.css. */
function rootTokens(css: string): string[] {
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return [...rootBlock.matchAll(/--([\w-]+)\s*:/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("theme tokens", () => {
  it("only allows tokens that exist on :root in src/index.css", () => {
    const declared = rootTokens(indexCss);
    for (const token of themeTokens) {
      expect(declared, token).toContain(token);
    }
  });
});

describe.each(Object.entries(niches))("niche %s", (registryKey, niche) => {
  it("passes the config schema", () => {
    expect(NicheConfigSchema.safeParse(niche).error).toBeUndefined();
  });

  it("is registered under its own id", () => {
    expect(niche.id).toBe(registryKey);
  });

  it.each([
    ["en", en],
    ["sv", sv],
  ])("has its name and description in %s", (_language, locale) => {
    for (const key of [niche.nameKey, niche.descriptionKey]) {
      expect(translation(locale, key), key).toBeTypeOf("string");
    }
  });
});

describe("niche registry", () => {
  it("covers all three niches, matching the shared id list", () => {
    expect(Object.keys(niches).sort()).toEqual(["aw", "bachelor", "team"]);
    expect(Object.keys(niches).sort()).toEqual([...nicheIds].sort());
  });
});

describe.each(Object.values(niches))("niche $id content", (niche) => {
  it.each(supportedLanguages)(
    "has a welcome text in %s that passes the party schema",
    (language) => {
      const result = PartySchema.safeParse({
        welcome: niche.welcome[language],
      });
      expect(result.error).toBeUndefined();
    },
  );

  it("has English prompt hints", () => {
    expect(niche.promptHints).toMatch(/^[\x20-\x7e]+$/);
  });
});

describe("NicheConfigSchema", () => {
  it("rejects a token that shadcn does not define", () => {
    const result = NicheConfigSchema.safeParse({
      ...niches.aw,
      theme: { "brand-pink": "pink" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a niche missing a welcome text for a language", () => {
    const result = NicheConfigSchema.safeParse({
      ...niches.aw,
      welcome: { en: "Hi" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown module", () => {
    const result = NicheConfigSchema.safeParse({
      ...niches.aw,
      defaultModules: ["karaoke"],
    });
    expect(result.success).toBe(false);
  });
});

describe("nicheThemeStyle", () => {
  it("maps tokens to CSS custom properties", () => {
    expect(nicheThemeStyle({ primary: "red", radius: "1rem" })).toEqual({
      "--primary": "red",
      "--radius": "1rem",
    });
  });
});

describe("isNicheId", () => {
  it("accepts registered ids and rejects anything else", () => {
    expect(isNicheId("aw")).toBe(true);
    expect(isNicheId("toString")).toBe(false);
    expect(isNicheId(42)).toBe(false);
  });
});
