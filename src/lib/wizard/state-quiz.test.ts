import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import { getNiche } from "@/niches";
import { loadDraft, saveDraft } from "./draft-storage";
import {
  firstInvalidDraftStep,
  initialDraft,
  isSkippable,
  stepsFor,
  toCreateInput,
  toCreateRequest,
  wizardReducer,
  type WizardAction,
  type WizardDraft,
} from "./state";

function run(draft: WizardDraft, ...actions: WizardAction[]) {
  return actions.reduce(wizardReducer, draft);
}

const quizOff = (draft: WizardDraft) =>
  run(draft, { type: "toggle_module", module: "quiz" });

describe("the quiz step", () => {
  it("comes after the activities step while the quiz is on", () => {
    const draft = initialDraft("en");
    const steps = stepsFor(draft);
    expect(steps[steps.indexOf("activities") + 1]).toBe("quiz");
    const next = run(
      draft,
      { type: "go_to", step: "activities" },
      { type: "next" },
    );
    expect(next.step).toBe("quiz");
  });

  it("is left out while the quiz is off", () => {
    const draft = quizOff(initialDraft("en"));
    expect(stepsFor(draft)).not.toContain("quiz");
    const next = run(
      draft,
      { type: "go_to", step: "activities" },
      { type: "next" },
    );
    expect(next.step).toBe("welcome");
    expect(run(next, { type: "back" }).step).toBe("activities");
  });

  it("is skippable, and skipping keeps the picked questions", () => {
    expect(isSkippable("quiz")).toBe(true);
    const draft = run(
      initialDraft("en"),
      { type: "quiz", action: { type: "seed", ids: ["a-1", "a-2"] } },
      { type: "go_to", step: "quiz" },
      { type: "skip" },
    );
    expect(draft.step).toBe("welcome");
    expect(draft.quiz.items).toHaveLength(2);
  });

  it("sends the picked questions in the event language, in order", () => {
    const [first, second] = getNiche("aw").quiz;
    if (!first || !second) throw new Error("no quiz content");
    const draft = run(initialDraft("sv"), {
      type: "quiz",
      action: { type: "seed", ids: [second.id, first.id] },
    });
    expect(toCreateInput(draft).quiz).toEqual([
      { ...second.texts.sv, correct: second.correct },
      { ...first.texts.sv, correct: first.correct },
    ]);
    expect(
      CreateEventRequestSchema.safeParse(toCreateRequest(draft)).success,
    ).toBe(true);
  });

  it("sends no questions with the quiz off or before any are picked", () => {
    const seeded = run(initialDraft("en"), {
      type: "quiz",
      action: { type: "seed", ids: [getNiche("aw").quiz[0]?.id ?? ""] },
    });
    expect(toCreateInput(quizOff(seeded))).not.toHaveProperty("quiz");
    expect(toCreateInput(initialDraft("en"))).not.toHaveProperty("quiz");
  });

  it("keeps the host's own questions when the niche changes, not the ready-made ones", () => {
    const draft = run(
      initialDraft("en"),
      { type: "quiz", action: { type: "seed", ids: ["aw-feta"] } },
      { type: "quiz", action: { type: "add_own", key: "k" } },
      { type: "select_niche", niche: "team" },
    );
    expect(draft.quiz.seeded).toBe(false);
    expect(draft.quiz.items.map((item) => item.kind)).toEqual(["own"]);
    // Picking the niche that is already selected changes nothing.
    expect(run(draft, { type: "select_niche", niche: "team" }).quiz).toEqual(
      draft.quiz,
    );
  });

  it("sends Create to the quiz step while an own question is unfinished", () => {
    const draft = run(
      initialDraft("en"),
      { type: "quiz", action: { type: "add_own", key: "k" } },
      { type: "set_music_url", url: "http://not-https.example" },
    );
    expect(firstInvalidDraftStep(draft)).toBe("quiz");
    expect(firstInvalidDraftStep(quizOff(draft))).toBe("wifi");
    expect(firstInvalidDraftStep(initialDraft("en"))).toBeUndefined();
  });
});

describe("saving the quiz draft", () => {
  afterEach(() => vi.unstubAllGlobals());

  function memoryStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    });
    return data;
  }

  it("restores the picked questions and the host's own, unfinished or not", () => {
    memoryStorage();
    const draft = run(
      initialDraft("en"),
      {
        type: "quiz",
        action: { type: "seed", ids: ["aw-feta", "aw-canberra"] },
      },
      { type: "quiz", action: { type: "add_own", key: "k1" } },
      {
        type: "quiz",
        action: { type: "edit_own", key: "k1", change: { text: "Half done" } },
      },
    );
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft saved before the quiz step existed, without questions", () => {
    const data = memoryStorage();
    const old: Partial<WizardDraft> = { ...initialDraft("en") };
    delete old.quiz;
    data.set("mingle.wizard-draft", JSON.stringify(old));
    expect(loadDraft()).toEqual(initialDraft("en"));
  });

  it("ignores a draft with more than 30 questions", () => {
    const data = memoryStorage();
    const items = Array.from({ length: 31 }, (_, i) => ({
      kind: "builtin",
      id: `aw-${i}`,
    }));
    data.set(
      "mingle.wizard-draft",
      JSON.stringify({ ...initialDraft("en"), quiz: { seeded: true, items } }),
    );
    expect(loadDraft()).toBeUndefined();
  });
});
