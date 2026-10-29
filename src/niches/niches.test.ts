import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import sv from "@/i18n/sv.json";
import themeCss from "@/app/theme.css?raw";
import { supportedLanguages } from "@/i18n/language";
import { AwardCategorySchema, awardsLimits } from "@/lib/schemas/awards";
import { HotTakeSchema, hottakesLimits } from "@/lib/schemas/hottakes";
import { PartySchema } from "@/lib/schemas/party";
import { QuizQuestionSchema, quizLimits } from "@/lib/schemas/quiz";
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

/** Token names declared on `:root` in src/app/theme.css. */
function rootTokens(css: string): string[] {
  const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return [...rootBlock.matchAll(/--([\w-]+)\s*:/g)].map(
    (match) => match[1] ?? "",
  );
}

describe("theme tokens", () => {
  it("only allows tokens that exist on :root in src/app/theme.css", () => {
    const declared = rootTokens(themeCss);
    for (const token of themeTokens) {
      expect(declared, token).toContain(token);
    }
  });
});

describe("niche themes", () => {
  it("maps each niche onto its Kalas theme", () => {
    expect(niches.aw.theme.id).toBe("garden");
    expect(niches.team.theme.id).toBe("loud");
    expect(niches.bachelor.theme.id).toBe("garden");
  });

  it("lets bachelor lead with blush through a token override", () => {
    expect(nicheThemeStyle(niches.bachelor.theme)).toMatchObject({
      "--primary": "var(--blush)",
    });
    expect(nicheThemeStyle(niches.aw.theme)).toEqual({});
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

describe.each(Object.values(niches))("niche $id quiz", (niche) => {
  it("has 30 questions, within the quiz limit", () => {
    expect(niche.quiz).toHaveLength(30);
    expect(niche.quiz.length).toBeLessThanOrEqual(quizLimits.questions);
  });

  it("has ids that are unique and start with the niche id", () => {
    const ids = niche.quiz.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${niche.id}-`), id).toBe(true);
  });

  it.each(supportedLanguages)(
    "has every question in %s, passing the shared question schema",
    (language) => {
      for (const question of niche.quiz) {
        const text = question.texts[language];
        const result = QuizQuestionSchema.safeParse({
          ...text,
          correct: question.correct,
        });
        expect(result.error, question.id).toBeUndefined();
      }
    },
  );

  it.each(supportedLanguages)(
    "has no duplicate options or duplicate questions in %s",
    (language) => {
      const texts = niche.quiz.map((question) => question.texts[language]);
      for (const { options } of texts) {
        const lowered = options.map((option) => option.toLowerCase());
        expect(new Set(lowered).size).toBe(options.length);
      }
      expect(new Set(texts.map((t) => t.text)).size).toBe(texts.length);
    },
  );

  it("spreads the right option over all four positions", () => {
    const counts = [0, 1, 2, 3].map(
      (position) =>
        niche.quiz.filter((question) => question.correct === position).length,
    );
    for (const count of counts) expect(count).toBeGreaterThanOrEqual(4);
  });
});

describe.each(Object.values(niches))("niche $id awards", (niche) => {
  it("has 20 categories, within the awards limit", () => {
    expect(niche.awards).toHaveLength(20);
    expect(niche.awards.length).toBeLessThanOrEqual(awardsLimits.categories);
  });

  it("has ids that are unique and start with the niche id", () => {
    const ids = niche.awards.map((award) => award.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${niche.id}-`), id).toBe(true);
  });

  it.each(supportedLanguages)(
    "has every category in %s, passing the shared category schema",
    (language) => {
      for (const award of niche.awards) {
        const result = AwardCategorySchema.safeParse({
          text: award.texts[language],
        });
        expect(result.error, award.id).toBeUndefined();
      }
    },
  );

  it.each(supportedLanguages)("has no duplicate texts in %s", (language) => {
    const texts = niche.awards.map((award) => award.texts[language]);
    expect(new Set(texts.map((t) => t.toLowerCase())).size).toBe(texts.length);
  });
});

describe.each(Object.values(niches))("niche $id hot takes", (niche) => {
  it("has 20 hot takes, within the takes limit", () => {
    expect(niche.hottakes).toHaveLength(20);
    expect(niche.hottakes.length).toBeLessThanOrEqual(hottakesLimits.takes);
  });

  it("has ids that are unique and start with the niche id", () => {
    const ids = niche.hottakes.map((take) => take.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${niche.id}-`), id).toBe(true);
  });

  it.each(supportedLanguages)(
    "has every category in %s, passing the shared category schema",
    (language) => {
      for (const take of niche.hottakes) {
        const result = HotTakeSchema.safeParse({
          text: take.texts[language],
        });
        expect(result.error, take.id).toBeUndefined();
      }
    },
  );

  it.each(supportedLanguages)("has no duplicate texts in %s", (language) => {
    const texts = niche.hottakes.map((take) => take.texts[language]);
    expect(new Set(texts.map((t) => t.toLowerCase())).size).toBe(texts.length);
  });
});

describe("NicheConfigSchema", () => {
  it("rejects a token that shadcn does not define", () => {
    const result = NicheConfigSchema.safeParse({
      ...niches.aw,
      theme: { id: "garden", overrides: { "brand-pink": "pink" } },
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
    expect(
      nicheThemeStyle({
        id: "garden",
        overrides: { primary: "red", "primary-foreground": "white" },
      }),
    ).toEqual({
      "--primary": "red",
      "--primary-foreground": "white",
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
