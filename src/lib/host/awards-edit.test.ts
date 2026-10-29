import { describe, expect, it, vi } from "vitest";
import type { AwardCategoryView } from "@/api/awards";
import { getNiche } from "@/niches";
import {
  awardsEditErrorKey,
  awardsToDraft,
  canEditAwards,
  saveAwardsEdit,
} from "./awards-edit";

const target = { code: "ABCD", key: "k" };
const ready = getNiche("aw").awards[0];
if (!ready) throw new Error("niche has no awards content");

function view(
  position: number,
  fields: Partial<AwardCategoryView> = {},
): AwardCategoryView {
  return {
    id: `a${position}`,
    position,
    text: `Own ${position}`,
    voteCount: 0,
    revealed: false,
    ...fields,
  };
}

describe("awardsToDraft", () => {
  it("splits off the revealed categories and keeps the rest in order", () => {
    const { revealed, draft } = awardsToDraft("aw", "sv", [
      view(0, { revealed: true }),
      view(1),
      view(2),
    ]);
    expect(revealed.map((c) => c.id)).toEqual(["a0"]);
    expect(draft.seeded).toBe(true);
    expect(draft.items).toEqual([
      { kind: "own", key: "a1", text: "Own 1" },
      { kind: "own", key: "a2", text: "Own 2" },
    ]);
  });

  it("recognises ready-made categories, and hides revealed ones", () => {
    const text = ready.texts.sv;
    const { draft, hiddenIds } = awardsToDraft("aw", "sv", [
      view(0, { text, revealed: true }),
      view(1, { text: "Mine" }),
    ]);
    expect(hiddenIds).toEqual([ready.id]);
    expect(draft.items).toEqual([{ kind: "own", key: "a1", text: "Mine" }]);

    const unrevealed = awardsToDraft("aw", "sv", [view(0, { text })]);
    expect(unrevealed.draft.items).toEqual([{ kind: "builtin", id: ready.id }]);
    expect(unrevealed.hiddenIds).toEqual([]);
  });
});

describe("saveAwardsEdit", () => {
  const draft = awardsToDraft("aw", "sv", [view(0, { text: "  Mine " })]).draft;

  it("sends the trimmed unrevealed list", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, value: {} });
    expect(await saveAwardsEdit("aw", "sv", draft, target, send)).toEqual({
      ok: true,
    });
    expect(send).toHaveBeenCalledWith({
      ...target,
      categories: [{ text: "Mine" }],
    });
  });

  it("sends nothing while an own category is unfinished", async () => {
    const send = vi.fn();
    const blank = awardsToDraft("aw", "sv", [view(0, { text: " " })]).draft;
    expect(await saveAwardsEdit("aw", "sv", blank, target, send)).toEqual({
      ok: false,
      invalid: ["a0"],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("passes on the error code of a refusal", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "invalid_transition" });
    expect(await saveAwardsEdit("aw", "sv", draft, target, send)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});

describe("canEditAwards", () => {
  const idle = { status: "live", current_module: null, phase: "idle" };
  const progress = { total: 3, revealed: 1 };

  it("allows it between categories and on the party screen", () => {
    expect(canEditAwards(idle, progress)).toBe(true);
    expect(canEditAwards({ ...idle, current_module: "awards" }, progress)).toBe(
      true,
    );
    expect(canEditAwards(idle, { total: 0, revealed: 0 })).toBe(true);
  });

  it("refuses while a category is open or revealed", () => {
    for (const phase of ["open", "revealed"]) {
      expect(
        canEditAwards({ ...idle, current_module: "awards", phase }, progress),
      ).toBe(false);
    }
  });

  it("refuses once every category is revealed or the event ended", () => {
    expect(canEditAwards(idle, { total: 3, revealed: 3 })).toBe(false);
    expect(canEditAwards({ ...idle, status: "ended" }, progress)).toBe(false);
  });
});

describe("awardsEditErrorKey", () => {
  it("has a message for every refusal", () => {
    expect(awardsEditErrorKey("invalid_transition")).toBe(
      "modules.awards.edit.errors.invalid_transition",
    );
    expect(awardsEditErrorKey("payload_too_large")).toBe(
      "modules.awards.edit.errors.invalid_request",
    );
    expect(awardsEditErrorKey("rate_limited")).not.toMatch(/awards\.edit/);
  });
});
