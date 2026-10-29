import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import { getNiche } from "@/niches";
import { loadDraft, saveDraft } from "./draft-storage";
import {
  stepIsInvalid,
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

const toggle =
  (module: "quiz" | "awards" | "hottakes") => (draft: WizardDraft) =>
    run(draft, { type: "toggle_module", module });
const hotTakesOff = toggle("hottakes");
const awardsOff = toggle("awards");
const quizOff = toggle("quiz");

// The aw niche starts with the quiz, awards and hot takes on.
const [first, second] = getNiche("aw").hottakes;
if (!first || !second) throw new Error("no hot takes content");

describe("the hot takes step", () => {
  it("comes after the awards step while hot takes are on", () => {
    const draft = initialDraft("en");
    const steps = stepsFor(draft);
    expect(steps[steps.indexOf("awards") + 1]).toBe("hottakes");
    expect(
      run(draft, { type: "go_to", step: "awards" }, { type: "next" }).step,
    ).toBe("hottakes");
    expect(
      run(draft, { type: "go_to", step: "hottakes" }, { type: "next" }).step,
    ).toBe("welcome");
  });

  it("follows the activities step when quiz and awards are off", () => {
    const draft = awardsOff(quizOff(initialDraft("en")));
    expect(
      run(draft, { type: "go_to", step: "activities" }, { type: "next" }).step,
    ).toBe("hottakes");
  });

  it("is left out while hot takes are off", () => {
    const draft = hotTakesOff(initialDraft("en"));
    expect(stepsFor(draft)).not.toContain("hottakes");
    const next = run(
      draft,
      { type: "go_to", step: "awards" },
      { type: "next" },
    );
    expect(next.step).toBe("welcome");
    expect(run(next, { type: "back" }).step).toBe("awards");
  });

  it("is skippable, and skipping keeps the picked hot takes", () => {
    expect(isSkippable("hottakes")).toBe(true);
    const draft = run(
      initialDraft("en"),
      {
        type: "hottakes",
        action: { type: "seed", ids: [first.id, second.id] },
      },
      { type: "go_to", step: "hottakes" },
      { type: "skip" },
    );
    expect(draft.step).toBe("welcome");
    expect(draft.hottakes.items).toHaveLength(2);
  });

  it("sends the picked hot takes in the event language, in order", () => {
    const draft = run(initialDraft("sv"), {
      type: "hottakes",
      action: { type: "seed", ids: [second.id, first.id] },
    });
    expect(toCreateInput(draft).hottakes).toEqual([
      { text: second.texts.sv },
      { text: first.texts.sv },
    ]);
    expect(
      CreateEventRequestSchema.safeParse(toCreateRequest(draft)).success,
    ).toBe(true);
  });

  it("sends no hot takes with hot takes off or before any are picked", () => {
    const seeded = run(initialDraft("en"), {
      type: "hottakes",
      action: { type: "seed", ids: [first.id] },
    });
    expect(toCreateInput(hotTakesOff(seeded))).not.toHaveProperty("hottakes");
    expect(toCreateInput(initialDraft("en"))).not.toHaveProperty("hottakes");
  });

  it("keeps the host's own hot takes when the niche changes, not the ready-made ones", () => {
    const draft = run(
      initialDraft("en"),
      { type: "hottakes", action: { type: "seed", ids: [first.id] } },
      { type: "hottakes", action: { type: "add_own", key: "k" } },
      { type: "select_niche", niche: "bachelor" },
    );
    expect(draft.hottakes.seeded).toBe(false);
    expect(draft.hottakes.items.map((item) => item.kind)).toEqual(["own"]);
  });

  it("blocks on an empty own hot take and sends Create to the step", () => {
    const draft = run(
      initialDraft("en"),
      { type: "hottakes", action: { type: "add_own", key: "k" } },
      { type: "set_music_url", url: "http://not-https.example" },
    );
    expect(stepIsInvalid(draft, "hottakes")).toBe(true);
    expect(firstInvalidDraftStep(draft)).toBe("hottakes");
    expect(firstInvalidDraftStep(hotTakesOff(draft))).toBe("wifi");

    const withQuiz = run(draft, {
      type: "quiz",
      action: { type: "add_own", key: "q" },
    });
    expect(firstInvalidDraftStep(withQuiz)).toBe("quiz");

    const fixed = run(draft, {
      type: "hottakes",
      action: { type: "edit_own", key: "k", change: { text: "Best at fika" } },
    });
    expect(stepIsInvalid(fixed, "hottakes")).toBe(false);
  });
});

describe("saving the awards draft", () => {
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

  it("restores the picks, their order and the host's own, unfinished or not", () => {
    memoryStorage();
    const draft = run(
      initialDraft("en"),
      { type: "go_to", step: "hottakes" },
      {
        type: "hottakes",
        action: { type: "seed", ids: [first.id, second.id] },
      },
      { type: "hottakes", action: { type: "move", from: 1, to: 0 } },
      { type: "hottakes", action: { type: "add_own", key: "k1" } },
      {
        type: "hottakes",
        action: { type: "edit_own", key: "k1", change: { text: "Half" } },
      },
    );
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft saved before the hot takes step existed, without hot takes", () => {
    const data = memoryStorage();
    const old: Partial<WizardDraft> = { ...initialDraft("en") };
    delete old.hottakes;
    data.set("mingle.wizard-draft", JSON.stringify(old));
    expect(loadDraft()).toEqual(initialDraft("en"));
  });

  it("ignores a draft with more than 20 hot takes", () => {
    const data = memoryStorage();
    const items = Array.from({ length: 21 }, (_, i) => ({
      kind: "builtin",
      id: `aw-${i}`,
    }));
    data.set(
      "mingle.wizard-draft",
      JSON.stringify({
        ...initialDraft("en"),
        hottakes: { seeded: true, items },
      }),
    );
    expect(loadDraft()).toBeUndefined();
  });
});
