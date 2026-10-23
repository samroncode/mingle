import { describe, expect, it } from "vitest";
import { AwardCategoriesSchema, awardsLimits } from "@/lib/schemas/awards";
import { getNiche } from "@/niches";
import { nicheIds } from "@/niches/ids";
import {
  awardsReducer,
  defaultAwardsSize,
  emptyAwards,
  invalidOwnAwardKeys,
  pickDefaultAwardIds,
  toAwardCategories,
  type AwardsAction,
  type AwardsDraft,
} from "./awards";

function run(awards: AwardsDraft, ...actions: AwardsAction[]) {
  return actions.reduce(awardsReducer, awards);
}

const ids = (awards: AwardsDraft) =>
  awards.items.map((item) => (item.kind === "builtin" ? item.id : item.key));

describe("pickDefaultAwardIds", () => {
  it.each(nicheIds)(
    "picks eight different categories of the %s niche",
    (id) => {
      const picked = pickDefaultAwardIds(id);
      const known = new Set(getNiche(id).awards.map((a) => a.id));
      expect(defaultAwardsSize).toBe(8);
      expect(picked).toHaveLength(8);
      expect(new Set(picked).size).toBe(8);
      expect(picked.every((pick) => known.has(pick))).toBe(true);
    },
  );

  it("is a different pick for a different random source", () => {
    expect(pickDefaultAwardIds("aw", () => 0)).not.toEqual(
      pickDefaultAwardIds("aw", () => 0.999),
    );
  });
});

describe("editing the categories", () => {
  const seeded = run(emptyAwards, { type: "seed", ids: ["a-1", "a-2", "a-3"] });

  it("keeps the first pick when seeded again, so the pick stays stable", () => {
    expect(run(seeded, { type: "seed", ids: ["b-1"] })).toBe(seeded);
  });

  it("unticks, ticks, reorders and adds the host's own", () => {
    const awards = run(
      seeded,
      { type: "remove", index: 0 },
      { type: "add_builtin", id: "a-9" },
      { type: "move", from: 2, to: 0 },
      { type: "add_own", key: "k1" },
      { type: "edit_own", key: "k1", change: { text: "Best at fika" } },
    );
    expect(ids(awards)).toEqual(["a-9", "a-2", "a-3", "k1"]);
    expect(awards.items[3]).toEqual({
      kind: "own",
      key: "k1",
      text: "Best at fika",
    });
  });

  it("stops at 20 categories", () => {
    const full = run(emptyAwards, {
      type: "seed",
      ids: Array.from({ length: 20 }, (_, i) => `a-${i}`),
    });
    expect(awardsLimits.categories).toBe(20);
    expect(run(full, { type: "add_own", key: "k" })).toEqual(full);
    expect(run(full, { type: "add_builtin", id: "a-99" })).toEqual(full);
  });
});

describe("toAwardCategories", () => {
  const [first, second] = getNiche("aw").awards;
  if (!first || !second) throw new Error("no awards content");

  it("copies ready-made ones in the event language, in order, and trims the host's own", () => {
    const awards = run(
      emptyAwards,
      { type: "seed", ids: [second.id, first.id] },
      { type: "add_own", key: "k" },
      { type: "edit_own", key: "k", change: { text: "  Bäst på fika " } },
    );
    const categories = toAwardCategories("aw", "sv", awards);
    expect(categories).toEqual([
      { text: second.texts.sv },
      { text: first.texts.sv },
      { text: "Bäst på fika" },
    ]);
    expect(AwardCategoriesSchema.safeParse(categories).success).toBe(true);
    expect(toAwardCategories("aw", "en", awards)[0]).toEqual({
      text: second.texts.en,
    });
  });

  it("leaves out a ready-made id the niche doesn't have", () => {
    const awards = run(emptyAwards, { type: "seed", ids: ["gone", first.id] });
    expect(toAwardCategories("aw", "en", awards)).toEqual([
      { text: first.texts.en },
    ]);
  });
});

describe("invalidOwnAwardKeys", () => {
  it("lists the host's own categories that are empty or too long", () => {
    const awards = run(
      emptyAwards,
      { type: "seed", ids: ["aw-snacks"] },
      { type: "add_own", key: "empty" },
      { type: "add_own", key: "blank" },
      { type: "edit_own", key: "blank", change: { text: "   " } },
      { type: "add_own", key: "long" },
      { type: "edit_own", key: "long", change: { text: "x".repeat(121) } },
      { type: "add_own", key: "ok" },
      { type: "edit_own", key: "ok", change: { text: "x".repeat(120) } },
    );
    expect(invalidOwnAwardKeys(awards)).toEqual(["empty", "blank", "long"]);
  });
});
