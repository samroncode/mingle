import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import { getNiche } from "@/niches";
import { loadDraft, saveDraft } from "./draft-storage";
import {
  firstInvalidDraftStep,
  initialDraft,
  isSkippable,
  stepIsInvalid,
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

const toggleCompetitions = (draft: WizardDraft) =>
  run(draft, { type: "toggle_module", module: "competitions" });

// The aw niche starts with Competitions off; team and bachelor have it on.
const [first, second] = getNiche("aw").competitions;
if (!first || !second) throw new Error("no competitions content");

describe("the competitions step", () => {
  it("is off in the aw niche and on in team and bachelor", () => {
    expect(initialDraft("en").enabledModules).not.toContain("competitions");
    for (const niche of ["team", "bachelor"] as const) {
      const draft = run(initialDraft("en"), { type: "select_niche", niche });
      expect(draft.enabledModules).toContain("competitions");
      expect(stepsFor(draft)).toContain("competitions");
    }
  });

  it("comes after the hot takes step while Competitions is on", () => {
    const draft = toggleCompetitions(initialDraft("en"));
    const steps = stepsFor(draft);
    expect(steps[steps.indexOf("hottakes") + 1]).toBe("competitions");
    expect(
      run(draft, { type: "go_to", step: "hottakes" }, { type: "next" }).step,
    ).toBe("competitions");
  });

  it("is left out while Competitions is off", () => {
    expect(stepsFor(initialDraft("en"))).not.toContain("competitions");
  });

  it("is skippable, and skipping keeps what was picked", () => {
    expect(isSkippable("competitions")).toBe(true);
    const draft = run(
      toggleCompetitions(initialDraft("en")),
      {
        type: "competitions",
        action: { type: "add_builtin", id: first.id },
      },
      { type: "go_to", step: "competitions" },
      { type: "skip" },
    );
    expect(draft.step).toBe("welcome");
    expect(draft.competitions.items).toHaveLength(1);
  });

  it("sends the picked competitions in the event language, in order", () => {
    const draft = run(
      toggleCompetitions(initialDraft("sv")),
      { type: "competitions", action: { type: "add_builtin", id: second.id } },
      { type: "competitions", action: { type: "add_builtin", id: first.id } },
    );
    expect(toCreateInput(draft).competitions).toEqual([
      { name: second.names.sv },
      { name: first.names.sv },
    ]);
    expect(
      CreateEventRequestSchema.safeParse(toCreateRequest(draft)).success,
    ).toBe(true);
  });

  it("sends no competitions with Competitions off or before any are picked", () => {
    const picked = run(toggleCompetitions(initialDraft("en")), {
      type: "competitions",
      action: { type: "add_builtin", id: first.id },
    });
    expect(toCreateInput(toggleCompetitions(picked))).not.toHaveProperty(
      "competitions",
    );
    expect(
      toCreateInput(toggleCompetitions(initialDraft("en"))),
    ).not.toHaveProperty("competitions");
  });

  it("keeps the host's own competitions when the niche changes, not the suggestions", () => {
    const draft = run(
      toggleCompetitions(initialDraft("en")),
      { type: "competitions", action: { type: "add_builtin", id: first.id } },
      { type: "competitions", action: { type: "add_own", key: "k" } },
      { type: "select_niche", niche: "team" },
    );
    expect(draft.competitions.items.map((item) => item.kind)).toEqual(["own"]);
    expect(draft.competitions.seeded).toBe(true);
  });

  it("blocks on an empty own name and sends Create to the step", () => {
    const draft = run(toggleCompetitions(initialDraft("en")), {
      type: "competitions",
      action: { type: "add_own", key: "k" },
    });
    expect(stepIsInvalid(draft, "competitions")).toBe(true);
    expect(firstInvalidDraftStep(draft)).toBe("competitions");
    expect(firstInvalidDraftStep(toggleCompetitions(draft))).toBeUndefined();

    const fixed = run(draft, {
      type: "competitions",
      action: { type: "edit_own", key: "k", change: { name: "Kubb" } },
    });
    expect(stepIsInvalid(fixed, "competitions")).toBe(false);
  });
});

describe("saving the competitions draft", () => {
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

  it("restores the picks and the host's own, unfinished or not", () => {
    memoryStorage();
    const draft = run(
      toggleCompetitions(initialDraft("en")),
      { type: "competitions", action: { type: "add_builtin", id: first.id } },
      { type: "competitions", action: { type: "add_own", key: "k1" } },
      {
        type: "competitions",
        action: { type: "edit_own", key: "k1", change: { name: "Hal" } },
      },
    );
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });

  it("restores a draft saved before the step existed, without competitions", () => {
    const data = memoryStorage();
    const old: Partial<WizardDraft> = { ...initialDraft("en") };
    delete old.competitions;
    data.set("mingle.wizard-draft", JSON.stringify(old));
    expect(loadDraft()).toEqual(initialDraft("en"));
  });

  it("ignores a draft with more than five competitions", () => {
    const data = memoryStorage();
    const items = Array.from({ length: 6 }, (_, i) => ({
      kind: "builtin",
      id: `aw-${i}`,
    }));
    data.set(
      "mingle.wizard-draft",
      JSON.stringify({
        ...initialDraft("en"),
        competitions: { seeded: true, items },
      }),
    );
    expect(loadDraft()).toBeUndefined();
  });
});
