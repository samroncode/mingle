import { describe, expect, it, vi } from "vitest";
import type { QuizQuestionView } from "@/api/quiz";
import { getNiche } from "@/niches";
import {
  canEditQuiz,
  quizEditErrorKey,
  quizToDraft,
  saveQuizEdit,
} from "./quiz-edit";

const target = { code: "ABCD", key: "k" };
const [ready, other] = getNiche("aw").quiz;
if (!ready || !other) throw new Error("niche has no quiz content");

function view(
  position: number,
  fields: Partial<QuizQuestionView> = {},
): QuizQuestionView {
  return {
    id: `q${position}`,
    position,
    text: `Own ${position}?`,
    options: ["a", "b", "c", "d"],
    correct: 2,
    answerCount: 0,
    played: false,
    ...fields,
  };
}

/** The question as the event stores a ready-made one, copied in Swedish. */
function copied(position: number, played = false): QuizQuestionView {
  return view(position, {
    text: ready!.texts.sv.text,
    options: [...ready!.texts.sv.options],
    correct: ready!.correct,
    played,
  });
}

describe("quizToDraft", () => {
  it("splits off the played questions and keeps the rest in order", () => {
    const { played, draft } = quizToDraft("aw", "sv", [
      view(0, { played: true }),
      view(1),
      view(2),
    ]);
    expect(played.map((q) => q.id)).toEqual(["q0"]);
    expect(draft.seeded).toBe(true);
    expect(draft.items).toEqual([
      {
        kind: "own",
        key: "q1",
        text: "Own 1?",
        options: ["a", "b", "c", "d"],
        correct: 2,
      },
      {
        kind: "own",
        key: "q2",
        text: "Own 2?",
        options: ["a", "b", "c", "d"],
        correct: 2,
      },
    ]);
  });

  it("knows a ready-made question again, so it can be unticked and ticked", () => {
    const { draft } = quizToDraft("aw", "sv", [copied(0)]);
    expect(draft.items).toEqual([{ kind: "builtin", id: ready.id }]);
  });

  it("hides a played ready-made question from the ones to add", () => {
    const { hiddenIds } = quizToDraft("aw", "sv", [copied(0, true)]);
    expect(hiddenIds).toEqual([ready.id]);
  });

  it("treats a ready-made question in another language as the host's own", () => {
    const { draft } = quizToDraft("aw", "en", [copied(0)]);
    expect(draft.items[0]?.kind).toBe("own");
  });
});

describe("saveQuizEdit", () => {
  it("sends the unplayed list in the order shown, ready-made ones copied", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const { draft } = quizToDraft("aw", "sv", [
      view(0, { played: true }),
      view(1),
    ]);
    draft.items.unshift({ kind: "builtin", id: other.id });

    expect(await saveQuizEdit("aw", "sv", draft, target, send)).toEqual({
      ok: true,
    });
    expect(send).toHaveBeenCalledWith({
      ...target,
      questions: [
        { ...other.texts.sv, correct: other.correct },
        { text: "Own 1?", options: ["a", "b", "c", "d"], correct: 2 },
      ],
    });
  });

  it("sends nothing while one of the host's own questions is unfinished", async () => {
    const send = vi.fn();
    const { draft } = quizToDraft("aw", "sv", [view(0, { text: " " })]);

    expect(await saveQuizEdit("aw", "sv", draft, target, send)).toEqual({
      ok: false,
      invalid: ["q0"],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("passes on the error host-actions answers", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "invalid_transition" });
    const { draft } = quizToDraft("aw", "sv", [view(0)]);
    expect(await saveQuizEdit("aw", "sv", draft, target, send)).toEqual({
      ok: false,
      error: "invalid_transition",
    });
  });
});

describe("canEditQuiz", () => {
  const lobby = { status: "lobby", current_module: null, phase: "idle" };
  const quizAt = (phase: string) => ({
    status: "live",
    current_module: "quiz",
    phase,
  });
  const someLeft = { total: 3, played: 1 };

  it.each([
    ["before the quiz starts", lobby, someLeft, true],
    ["for an empty quiz", lobby, { total: 0, played: 0 }, true],
    ["between questions", quizAt("idle"), someLeft, true],
    [
      "while another activity runs",
      { ...quizAt("open"), current_module: "awards" },
      someLeft,
      true,
    ],
    ["while a question is open", quizAt("open"), someLeft, false],
    ["while a question is revealed", quizAt("revealed"), someLeft, false],
    ["once every question is played", lobby, { total: 3, played: 3 }, false],
    ["after the evening", { ...lobby, status: "ended" }, someLeft, false],
  ])("%s: %s", (_, event, progress, allowed) => {
    expect(canEditQuiz(event, progress)).toBe(allowed);
  });
});

describe("quizEditErrorKey", () => {
  it.each([
    ["invalid_transition", "modules.quiz.edit.errors.invalid_transition"],
    ["module_disabled", "modules.quiz.edit.errors.module_disabled"],
    ["invalid_request", "modules.quiz.edit.errors.invalid_request"],
    ["payload_too_large", "modules.quiz.edit.errors.invalid_request"],
    ["rate_limited", "hostPanel.errors.rate_limited"],
    ["not_authorized", "hostPanel.errors.not_authorized"],
    ["network_error", "hostPanel.errors.network_error"],
    ["internal_error", "hostPanel.errors.internal_error"],
  ] as const)("maps %s to %s", (error, key) => {
    expect(quizEditErrorKey(error)).toBe(key);
  });
});
