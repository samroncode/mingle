import { describe, expect, it } from "vitest";
import en from "./en.json";
import sv from "./sv.json";

/** Flattens nested translations into entries like ["language.label", "Språk"]. */
function flatten(value: unknown, prefix = ""): [string, unknown][] {
  if (typeof value !== "object" || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const locales = { en, sv };

describe("translations", () => {
  it("have the same keys in Swedish and English", () => {
    const svKeys = flatten(sv).map(([key]) => key);
    const enKeys = flatten(en).map(([key]) => key);
    expect(svKeys.toSorted()).toEqual(enKeys.toSorted());
  });

  it.each(Object.entries(locales))(
    "has only non-empty strings in %s",
    (_name, locale) => {
      for (const [key, text] of flatten(locale)) {
        expect(text, key).toBeTypeOf("string");
        expect(text, key).not.toBe("");
      }
    },
  );
});
