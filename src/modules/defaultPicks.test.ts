import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPicks } from "./defaultPicks";
import { moduleIds } from "./registry";

const api = vi.hoisted(() => ({
  getQuizProgress: vi.fn(),
  getAwardProgress: vi.fn(),
  getHotTakeProgress: vi.fn(),
  updateQuiz: vi.fn(),
  updateAwards: vi.fn(),
  updateHotTakes: vi.fn(),
}));

vi.mock("@/api/quiz", () => ({ getQuizProgress: api.getQuizProgress }));
vi.mock("@/api/awards", () => ({ getAwardProgress: api.getAwardProgress }));
vi.mock("@/api/hottakes", () => ({
  getHotTakeProgress: api.getHotTakeProgress,
}));
vi.mock("@/api/host-actions", () => ({
  updateQuiz: api.updateQuiz,
  updateAwards: api.updateAwards,
  updateHotTakes: api.updateHotTakes,
}));

const target = {
  eventId: "event-1",
  code: "ABC234",
  key: "key",
  niche: "aw",
  language: "en",
} as const;

const empty = { ok: true, value: { total: 0, played: 0, revealed: 0 } };
const saved = { ok: true, data: {} };

const cases = [
  ["quiz", "getQuizProgress", "updateQuiz", "questions", 10],
  ["awards", "getAwardProgress", "updateAwards", "categories", 8],
  ["hottakes", "getHotTakeProgress", "updateHotTakes", "takes", 8],
] as const;

beforeEach(() => vi.clearAllMocks());

describe("defaultPicks", () => {
  it("has a pick for every activity", () => {
    expect(Object.keys(defaultPicks).sort()).toEqual([...moduleIds].sort());
  });

  describe.each(cases)("%s", (id, progress, update, field, size) => {
    it(`saves the wizard's pick of ${size} when it has no items`, async () => {
      api[progress].mockResolvedValue(empty);
      api[update].mockResolvedValue(saved);

      const result = await defaultPicks[id](target, () => 0.5);

      expect(result).toEqual({ ok: true, picked: true });
      expect(api[update]).toHaveBeenCalledOnce();
      const sent = api[update].mock.calls[0]?.[0] as Record<string, unknown[]>;
      expect(sent).toMatchObject({ code: "ABC234", key: "key" });
      expect(sent[field]).toHaveLength(size);
    });

    it("leaves an activity that already has items alone", async () => {
      api[progress].mockResolvedValue({
        ok: true,
        value: { total: 3, played: 0, revealed: 0 },
      });

      const result = await defaultPicks[id](target);

      expect(result).toEqual({ ok: true, picked: false });
      expect(api[update]).not.toHaveBeenCalled();
    });

    it("fails when the progress can't be read", async () => {
      api[progress].mockResolvedValue({ ok: false, error: "unknown" });

      expect(await defaultPicks[id](target)).toEqual({ ok: false });
      expect(api[update]).not.toHaveBeenCalled();
    });

    it("passes on the code of a refused update", async () => {
      api[progress].mockResolvedValue(empty);
      api[update].mockResolvedValue({ ok: false, error: "network_error" });

      expect(await defaultPicks[id](target)).toEqual({
        ok: false,
        error: "network_error",
      });
    });
  });
});
