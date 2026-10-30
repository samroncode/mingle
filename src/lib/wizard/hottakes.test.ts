import { describe, expect, it } from "vitest";
import { HotTakesSchema, hottakesLimits } from "@/lib/schemas/hottakes";
import { getNiche } from "@/niches";
import { nicheIds } from "@/niches/ids";
import {
  hotTakesReducer,
  defaultHotTakesSize,
  emptyHotTakes,
  invalidOwnHotTakeKeys,
  pickDefaultHotTakeIds,
  toHotTakes,
  type HotTakesAction,
  type HotTakesDraft,
} from "./hottakes";

function run(takes: HotTakesDraft, ...actions: HotTakesAction[]) {
  return actions.reduce(hotTakesReducer, takes);
}

describe("pickDefaultHotTakeIds", () => {
  it.each(nicheIds)("picks eight different hot takes of the %s niche", (id) => {
    const picked = pickDefaultHotTakeIds(id);
    const known = new Set(getNiche(id).hottakes.map((a) => a.id));
    expect(defaultHotTakesSize).toBe(8);
    expect(picked).toHaveLength(8);
    expect(new Set(picked).size).toBe(8);
    expect(picked.every((pick) => known.has(pick))).toBe(true);
  });

  it("is a different pick for a different random source", () => {
    expect(pickDefaultHotTakeIds("aw", () => 0)).not.toEqual(
      pickDefaultHotTakeIds("aw", () => 0.999),
    );
  });
});

describe("editing the hot takes", () => {
  it("stops at 20 hot takes", () => {
    const full = run(emptyHotTakes, {
      type: "seed",
      ids: Array.from({ length: 20 }, (_, i) => `a-${i}`),
    });
    expect(hottakesLimits.takes).toBe(20);
    expect(run(full, { type: "add_own", key: "k" })).toEqual(full);
    expect(run(full, { type: "add_builtin", id: "a-99" })).toEqual(full);
  });
});

describe("toHotTakes", () => {
  const [first, second] = getNiche("aw").hottakes;
  if (!first || !second) throw new Error("no hot takes content");

  it("copies ready-made ones in the event language, in order, and trims the host's own", () => {
    const takes = run(
      emptyHotTakes,
      { type: "seed", ids: [second.id, first.id] },
      { type: "add_own", key: "k" },
      { type: "edit_own", key: "k", change: { text: "  Bäst på fika " } },
    );
    const picked = toHotTakes("aw", "sv", takes);
    expect(picked).toEqual([
      { text: second.texts.sv },
      { text: first.texts.sv },
      { text: "Bäst på fika" },
    ]);
    expect(HotTakesSchema.safeParse(picked).success).toBe(true);
    expect(toHotTakes("aw", "en", takes)[0]).toEqual({
      text: second.texts.en,
    });
  });

  it("leaves out a ready-made id the niche doesn't have", () => {
    const takes = run(emptyHotTakes, { type: "seed", ids: ["gone", first.id] });
    expect(toHotTakes("aw", "en", takes)).toEqual([{ text: first.texts.en }]);
  });
});

describe("invalidOwnHotTakeKeys", () => {
  it("lists the host's own hot takes that are empty or too long", () => {
    const takes = run(
      emptyHotTakes,
      { type: "seed", ids: ["aw-snacks"] },
      { type: "add_own", key: "empty" },
      { type: "add_own", key: "blank" },
      { type: "edit_own", key: "blank", change: { text: "   " } },
      { type: "add_own", key: "long" },
      { type: "edit_own", key: "long", change: { text: "x".repeat(121) } },
      { type: "add_own", key: "ok" },
      { type: "edit_own", key: "ok", change: { text: "x".repeat(120) } },
    );
    expect(invalidOwnHotTakeKeys(takes)).toEqual(["empty", "blank", "long"]);
  });
});
