import { describe, expect, it, vi } from "vitest";
import type { HotTakeView } from "@/api/hottakes";
import { getNiche } from "@/niches";
import {
  hotTakesEditErrorKey,
  hotTakesToDraft,
  canEditHotTakes,
  saveHotTakesEdit,
} from "./hottakes-edit";

const target = { code: "ABCD", key: "k" };
const ready = getNiche("aw").hottakes[0];
if (!ready) throw new Error("niche has no hot takes content");

function view(
  position: number,
  fields: Partial<HotTakeView> = {},
): HotTakeView {
  return {
    id: `h${position}`,
    position,
    text: `Own ${position}`,
    answerCount: 0,
    revealed: false,
    ...fields,
  };
}

describe("hotTakesToDraft", () => {
  it("splits off the revealed hot takes and keeps the rest in order", () => {
    const { revealed, draft } = hotTakesToDraft("aw", "sv", [
      view(0, { revealed: true }),
      view(1),
      view(2),
    ]);
    expect(revealed.map((c) => c.id)).toEqual(["h0"]);
    expect(draft.seeded).toBe(true);
    expect(draft.items).toEqual([
      { kind: "own", key: "h1", text: "Own 1" },
      { kind: "own", key: "h2", text: "Own 2" },
    ]);
  });

  it("recognises ready-made takes, and hides revealed ones", () => {
    const text = ready.texts.sv;
    const { draft, hiddenIds } = hotTakesToDraft("aw", "sv", [
      view(0, { text, revealed: true }),
      view(1, { text: "Mine" }),
    ]);
    expect(hiddenIds).toEqual([ready.id]);
    expect(draft.items).toEqual([{ kind: "own", key: "h1", text: "Mine" }]);

    const unrevealed = hotTakesToDraft("aw", "sv", [view(0, { text })]);
    expect(unrevealed.draft.items).toEqual([{ kind: "builtin", id: ready.id }]);
    expect(unrevealed.hiddenIds).toEqual([]);
  });
});

describe("saveHotTakesEdit", () => {
  const draft = hotTakesToDraft("aw", "sv", [
    view(0, { text: "  Mine " }),
  ]).draft;

  it("sends the trimmed unrevealed list", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, value: {} });
    expect(await saveHotTakesEdit("aw", "sv", draft, target, send)).toEqual({
      ok: true,
    });
    expect(send).toHaveBeenCalledWith({
      ...target,
      takes: [{ text: "Mine" }],
    });
  });

  it("sends nothing while an own take is unfinished", async () => {
    const send = vi.fn();
    const blank = hotTakesToDraft("aw", "sv", [view(0, { text: " " })]).draft;
    expect(await saveHotTakesEdit("aw", "sv", blank, target, send)).toEqual({
      ok: false,
      invalid: ["h0"],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("passes on the error code of a refusal", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "invalid_transition" });
    expect(await saveHotTakesEdit("aw", "sv", draft, target, send)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});

describe("canEditHotTakes", () => {
  const idle = { status: "live", current_module: null, phase: "idle" };
  const progress = { total: 3, revealed: 1 };

  it("allows it between takes and on the party screen", () => {
    expect(canEditHotTakes(idle, progress)).toBe(true);
    expect(
      canEditHotTakes({ ...idle, current_module: "hottakes" }, progress),
    ).toBe(true);
    expect(canEditHotTakes(idle, { total: 0, revealed: 0 })).toBe(true);
  });

  it("refuses while a take is open or revealed", () => {
    for (const phase of ["open", "revealed"]) {
      expect(
        canEditHotTakes(
          { ...idle, current_module: "hottakes", phase },
          progress,
        ),
      ).toBe(false);
    }
  });

  it("refuses once every take is revealed or the event ended", () => {
    expect(canEditHotTakes(idle, { total: 3, revealed: 3 })).toBe(false);
    expect(canEditHotTakes({ ...idle, status: "ended" }, progress)).toBe(false);
  });
});

describe("hotTakesEditErrorKey", () => {
  it("has a message for every refusal", () => {
    expect(hotTakesEditErrorKey("invalid_transition")).toBe(
      "modules.hottakes.edit.errors.invalid_transition",
    );
    expect(hotTakesEditErrorKey("payload_too_large")).toBe(
      "modules.hottakes.edit.errors.invalid_request",
    );
    expect(hotTakesEditErrorKey("rate_limited")).not.toMatch(/hottakes\.edit/);
  });
});
