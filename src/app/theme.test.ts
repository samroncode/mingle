import { describe, expect, it } from "vitest";
import themeCss from "./theme.css?raw";
import { themeIds } from "@/niches/types";

type Tokens = Record<string, string>;

/** Reads the `--name: #hex` declarations of one theme block in theme.css. */
function themeTokens(id: (typeof themeIds)[number]): Tokens {
  const start = themeCss.search(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{`));
  const block = themeCss.slice(start, themeCss.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
      m[1] ?? "",
      m[2] ?? "",
    ]),
  );
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const brights = ["coral", "blush", "champagne", "sage", "danger"];
const soft = ["coral", "blush", "champagne", "sage"];
const surfaces = ["surface", "surface-sunken"];

/** Every text pair named in docs/design.md, as [text token, background token]. */
const pairs: [string, string][] = [
  ...surfaces.flatMap((s): [string, string][] => [
    ["ink", s],
    ["ink-muted", s],
  ]),
  ["on-paper", "paper"],
  ["on-paper-muted", "paper"],
  ["on-forest", "forest"],
  ["on-disabled", "disabled"],
  ...brights.map((b): [string, string] => ["on-bright", b]),
  ...soft.map((c): [string, string] => ["ink", `${c}-soft`]),
  ...soft.map((c): [string, string] => ["on-bright", `${c}-soft-fill`]),
  ...soft.flatMap((c): [string, string][] =>
    surfaces.map((s): [string, string] => [`${c}-text`, s]),
  ),
  ["danger-text", "surface"],
  ["danger-text", "surface-sunken"],
];

describe.each(themeIds)("theme %s", (id) => {
  const tokens = themeTokens(id);

  it("reaches 4.5:1 for every text pair", () => {
    const failing = pairs
      .filter(([text, background]) => {
        const fg = tokens[text];
        const bg = tokens[background];
        return !fg || !bg || contrast(fg, bg) < 4.5;
      })
      .map(([text, background]) => `${text} on ${background}`);
    expect(failing).toEqual([]);
  });

  it("keeps line-strong visible (3:1) on the surfaces", () => {
    for (const s of surfaces) {
      expect(
        contrast(tokens["line-strong"] ?? "", tokens[s] ?? ""),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("token coverage", () => {
  const garden = themeTokens("garden");

  it("declares the same color tokens in every theme", () => {
    const names = Object.keys(garden).sort();
    for (const id of themeIds) {
      expect(Object.keys(themeTokens(id)).sort(), id).toEqual(names);
    }
  });

  it("checks every text-bearing token a theme declares", () => {
    const checked = new Set(pairs.flat());
    const textBearing = Object.keys(garden).filter((name) =>
      /^(ink|on-|.*-text$|.*-soft$|.*-soft-fill$)/.test(name),
    );
    // Add new text tokens to `pairs` above so the 4.5:1 rule covers them.
    expect(textBearing.filter((name) => !checked.has(name))).toEqual([]);
  });
});

describe.each(themeIds)("theme %s focus ring", (id) => {
  it("reaches 3:1 on the surfaces", () => {
    const tokens = themeTokens(id);
    for (const bg of surfaces) {
      expect(
        contrast(tokens.focus ?? "", tokens[bg] ?? ""),
        bg,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("reaches 3:1 on paper for controls inside cards", () => {
    const tokens = themeTokens(id);
    expect(
      contrast(tokens["focus-on-paper"] ?? "", tokens.paper ?? ""),
    ).toBeGreaterThanOrEqual(3);
  });
});
