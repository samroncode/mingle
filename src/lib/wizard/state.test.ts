import { describe, expect, it } from "vitest";
import { niches } from "@/niches";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import {
  initialDraft,
  stepOrder,
  toCreateRequest,
  wizardReducer,
  type WizardAction,
  type WizardDraft,
} from "./state";

function run(draft: WizardDraft, ...actions: WizardAction[]) {
  return actions.reduce(wizardReducer, draft);
}

describe("initialDraft", () => {
  it("starts on the first step with the given language and the niche defaults", () => {
    const draft = initialDraft("sv");
    expect(draft.step).toBe(stepOrder[0]);
    expect(draft.language).toBe("sv");
    expect(draft.enabledModules).toEqual(niches[draft.niche].defaultModules);
  });
});

describe("steps", () => {
  it("walks forward and back through the step order and stops at the ends", () => {
    let draft = initialDraft("en");
    const seen = [draft.step];
    for (let i = 0; i < stepOrder.length + 2; i++) {
      draft = wizardReducer(draft, { type: "next" });
      seen.push(draft.step);
    }
    expect(seen.slice(0, stepOrder.length)).toEqual([...stepOrder]);
    expect(draft.step).toBe(stepOrder.at(-1));

    for (let i = 0; i < stepOrder.length + 2; i++) {
      draft = wizardReducer(draft, { type: "back" });
    }
    expect(draft.step).toBe(stepOrder[0]);
  });

  it("jumps to a step and keeps the other input", () => {
    const draft = run(
      initialDraft("en"),
      { type: "set_language", language: "sv" },
      { type: "go_to", step: "summary" },
      { type: "go_to", step: "language" },
    );
    expect(draft.step).toBe("language");
    expect(draft.language).toBe("sv");
  });
});

describe("activities", () => {
  it("toggles one activity and allows switching all of them off", () => {
    let draft = initialDraft("en");
    for (const module of draft.enabledModules) {
      draft = wizardReducer(draft, { type: "toggle_module", module });
    }
    expect(draft.enabledModules).toEqual([]);
    draft = wizardReducer(draft, { type: "toggle_module", module: "quiz" });
    expect(draft.enabledModules).toEqual(["quiz"]);
  });

  it("resets to the niche defaults when the niche changes", () => {
    const draft = run(
      initialDraft("en"),
      { type: "toggle_module", module: "quiz" },
      { type: "select_niche", niche: "aw" },
    );
    expect(draft.enabledModules).toEqual(niches.aw.defaultModules);
  });
});

describe("toCreateRequest", () => {
  it("passes the create_event schema and carries the choices", () => {
    const draft = run(initialDraft("sv"), {
      type: "toggle_module",
      module: "awards",
    });
    const request = toCreateRequest(draft);
    expect(CreateEventRequestSchema.safeParse(request).error).toBeUndefined();
    expect(request).toEqual({
      action: "create_event",
      niche: "aw",
      language: "sv",
      enabledModules: ["quiz", "hottakes"],
      party: {},
    });
  });

  it("passes the schema with every activity off", () => {
    const start = initialDraft("en");
    const draft = run(
      start,
      ...start.enabledModules.map((module): WizardAction => ({
        type: "toggle_module",
        module,
      })),
    );
    expect(draft.enabledModules).toEqual([]);
    expect(
      CreateEventRequestSchema.safeParse(toCreateRequest(draft)).success,
    ).toBe(true);
  });
});
