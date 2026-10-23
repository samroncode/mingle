import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import { getNiche } from "@/niches";
import { loadDraft, saveDraft } from "./draft-storage";
import {
  awardsIsInvalid,
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

const toggle = (module: "quiz" | "awards") => (draft: WizardDraft) =>
  run(draft, { type: "toggle_module", module });
const awardsOff = toggle("awards");
const quizOff = toggle("quiz");

// The aw niche starts with the quiz and awards on.
const [first, second] = getNiche("aw").awards;
if (!first || !second) throw new Error("no awards content");

describe("the awards step", () => {
  it("comes after the quiz step while awards are on", () => {
    const draft = initialDraft("en");
    const steps = stepsFor(draft);
    expect(steps[steps.indexOf("quiz") + 1]).toBe("awards");
    expect(
      run(draft, { type: "go_to", step: "quiz" }, { type: "next" }).step,
    ).toBe("awards");
    expect(
      run(draft, { type: "go_to", step: "awards" }, { type: "next" }).step,
    ).toBe("welcome");
  });

  it("follows the activities step when the quiz is off", () => {
    const draft = quizOff(initialDraft("en"));
    expect(
      run(draft, { type: "go_to", step: "activities" }, { type: "next" }).step,
    ).toBe("awards");
  });

  it("is left out while awards are off", () => {
    const draft = awardsOff(initialDraft("en"));
    expect(stepsFor(draft)).not.toContain("awards");
    const next = run(draft, { type: "go_to", step: "quiz" }, { type: "next" });
    expect(next.step).toBe("welcome");
    expect(run(next, { type: "back" }).step).toBe("quiz");
  });

  it("is skippable, and skipping keeps the picked categories", () => {
    expect(isSkippable("awards")).toBe(true);
    const draft = run(
      initialDraft("en"),
      { type: "awards", action: { type: "seed", ids: [first.id, second.id] } },
      { type: "go_to", step: "awards" },
      { type: "skip" },
    );
    expect(draft.step).toBe("welcome");
    expect(draft.awards.items).toHaveLength(2);
  });

  it("sends the picked categories in the event language, in order", () => {
    const draft = run(initialDraft("sv"), {
      type: "awards",
      action: { type: "seed", ids: [second.id, first.id] },
    });
    expect(toCreateInput(draft).awards).toEqual([
      { text: second.texts.sv },
      { text: first.texts.sv },
    ]);
    expect(
      CreateEventRequestSchema.safeParse(toCreateRequest(draft)).success,
    ).toBe(true);
  });

  it("sends no categories with awards off or before any are picked", () => {
    const seeded = run(initialDraft("en"), {
      type: "awards",
      action: { type: "seed", ids: [first.id] },
    });
    expect(toCreateInput(awardsOff(seeded))).not.toHaveProperty("awards");
    expect(toCreateInput(initialDraft("en"))).not.toHaveProperty("awards");
  });

  it("keeps the host's own categories when the niche changes, not the ready-made ones", () => {
    const draft = run(
      initialDraft("en"),
      { type: "awards", action: { type: "seed", ids: [first.id] } },
      { type: "awards", action: { type: "add_own", key: "k" } },
      { type: "select_niche", niche: "bachelor" },
    );
    expect(draft.awards.seeded).toBe(false);
    expect(draft.awards.items.map((item) => item.kind)).toEqual(["own"]);
  });

  it("blocks on an empty own category and sends Create to the step", () => {
    const draft = run(
      initialDraft("en"),
      { type: "awards", action: { type: "add_own", key: "k" } },
      { type: "set_music_url", url: "http://not-https.example" },
    );
    expect(awardsIsInvalid(draft)).toBe(true);
    expect(firstInvalidDraftStep(draft)).toBe("awards");
    expect(firstInvalidDraftStep(awardsOff(draft))).toBe("wifi");

    const withQuiz = run(draft, {
      type: "quiz",
      action: { type: "add_own", key: "q" },
    });
    expect(firstInvalidDraftStep(withQuiz)).toBe("quiz");

    const fixed = run(draft, {
      type: "awards",
      action: { type: "edit_own", key: "k", change: { text: "Best at fika" } },
    });
    expect(awardsIsInvalid(fixed)).toBe(false);
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
      { type: "go_to", step: "awards" },
      { type: "awards", action: { type: "seed", ids: [first.id, second.id] } },
      { type: "awards", action: { type: "move", from: 1, to: 0 } },
      { type: "awards", action: { type: "add_own", key: "k1" } },
      {
        type: "awards",
        action: { type: "edit_own", key: "k1", change: { text: "Half" } },
      },
    );
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft saved before the awards step existed, without categories", () => {
    const data = memoryStorage();
    const old: Partial<WizardDraft> = { ...initialDraft("en") };
    delete old.awards;
    data.set("mingle.wizard-draft", JSON.stringify(old));
    expect(loadDraft()).toEqual(initialDraft("en"));
  });

  it("ignores a draft with more than 20 categories", () => {
    const data = memoryStorage();
    const items = Array.from({ length: 21 }, (_, i) => ({
      kind: "builtin",
      id: `aw-${i}`,
    }));
    data.set(
      "mingle.wizard-draft",
      JSON.stringify({
        ...initialDraft("en"),
        awards: { seeded: true, items },
      }),
    );
    expect(loadDraft()).toBeUndefined();
  });
});
