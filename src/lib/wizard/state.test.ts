import { describe, expect, it } from "vitest";
import { niches } from "@/niches";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import {
  initialDraft,
  invalidFields,
  isSkippable,
  stepInvalidFields,
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
      party: { welcome: niches.aw.welcome.sv },
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

describe("welcome text", () => {
  it("starts as the niche's text in the language and follows language and niche changes", () => {
    let draft = initialDraft("en");
    expect(draft.party.welcome).toBe(niches.aw.welcome.en);
    draft = run(draft, { type: "set_language", language: "sv" });
    expect(draft.party.welcome).toBe(niches.aw.welcome.sv);
    draft = run(draft, { type: "select_niche", niche: "team" });
    expect(draft.party.welcome).toBe(niches.team.welcome.sv);
  });

  it("is kept once the host has edited it", () => {
    const draft = run(
      initialDraft("en"),
      { type: "set_welcome", text: "Hello mates" },
      { type: "set_language", language: "sv" },
      { type: "select_niche", niche: "bachelor" },
    );
    expect(draft.party.welcome).toBe("Hello mates");
  });

  it("stays cleared after the host clears it, and is then left out", () => {
    const draft = run(
      initialDraft("en"),
      { type: "set_welcome", text: "" },
      { type: "set_language", language: "sv" },
    );
    expect(draft.party.welcome).toBe("");
    expect(toCreateRequest(draft).party).toEqual({});
  });
});

describe("party content in the request", () => {
  it("drops empty parts and keeps filled ones", () => {
    const draft = run(
      initialDraft("en"),
      { type: "set_welcome", text: "  " },
      { type: "set_menu", menu: ["Pizza", " ", "Cake "] },
      {
        type: "set_schedule",
        schedule: [
          { time: "19:00", title: "Dinner" },
          { time: "", title: "" },
        ],
      },
      { type: "set_wifi", ssid: "Home", password: "" },
      { type: "set_music_url", url: "" },
    );
    const request = toCreateRequest(draft);
    expect(CreateEventRequestSchema.safeParse(request).success).toBe(true);
    expect(request.party).toEqual({
      menu: ["Pizza", "Cake"],
      schedule: [{ time: "19:00", title: "Dinner" }],
      wifi: { ssid: "Home", password: "" },
    });
  });

  it("reports invalid content by field and step", () => {
    const draft = run(
      initialDraft("en"),
      { type: "set_schedule", schedule: [{ time: "25:99", title: "Late" }] },
      { type: "set_wifi", ssid: "", password: "secret" },
      { type: "set_music_url", url: "http://open.spotify.com/x" },
      { type: "set_welcome", text: "x".repeat(501) },
    );
    expect(invalidFields(draft.party).sort()).toEqual([
      "musicUrl",
      "schedule",
      "welcome",
      "wifi",
    ]);
    expect(stepInvalidFields(draft.party, "wifi").sort()).toEqual([
      "musicUrl",
      "wifi",
    ]);
    expect(stepInvalidFields(draft.party, "menu")).toEqual([]);
  });

  it("accepts a valid https music link", () => {
    const draft = run(initialDraft("en"), {
      type: "set_music_url",
      url: "https://open.spotify.com/jam/abc",
    });
    expect(invalidFields(draft.party)).toEqual([]);
  });
});

describe("skipping", () => {
  it("only allows skipping steps after language", () => {
    expect(isSkippable("niche")).toBe(false);
    expect(isSkippable("language")).toBe(false);
    expect(stepOrder.slice(2).every(isSkippable)).toBe(true);
  });

  it("clears invalid content on the step and moves on", () => {
    const draft = run(
      initialDraft("en"),
      { type: "go_to", step: "wifi" },
      { type: "set_wifi", ssid: "", password: "secret" },
      { type: "set_music_url", url: "nope" },
      { type: "skip" },
    );
    expect(draft.step).toBe("summary");
    expect(invalidFields(draft.party)).toEqual([]);
    expect(toCreateRequest(draft).party.wifi).toBeUndefined();
  });
});
