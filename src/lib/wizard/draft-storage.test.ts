import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "./draft-storage";
import { partyLimits } from "@/lib/schemas/party";
import { initialDraft, wizardReducer, type WizardDraft } from "./state";

function memoryStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  });
  return data;
}

function brokenStorage() {
  const fail = () => {
    throw new Error("denied");
  };
  vi.stubGlobal("localStorage", {
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  });
}

afterEach(() => vi.unstubAllGlobals());

const typed = wizardReducer(
  wizardReducer(initialDraft("en"), { type: "next" }),
  { type: "set_menu", menu: ["Pizza"] },
);

describe("wizard draft storage", () => {
  it("restores what was saved, including the step", () => {
    memoryStorage();
    saveDraft(typed);
    expect(loadDraft()).toEqual(typed);
  });

  it("restores a draft filled to every limit the wizard allows", () => {
    memoryStorage();
    const line = "x".repeat(partyLimits.line);
    const full: WizardDraft = {
      ...typed,
      party: {
        welcome: "x".repeat(partyLimits.welcome),
        welcomeEdited: true,
        menu: Array.from({ length: partyLimits.lines }, () => line),
        schedule: Array.from({ length: partyLimits.lines }, () => ({
          time: "19:00",
          title: line,
        })),
        wifiSsid: "x".repeat(partyLimits.ssid),
        wifiPassword: "x".repeat(partyLimits.password),
        musicUrl: "x".repeat(partyLimits.musicUrl),
      },
    };
    saveDraft(full);
    expect(loadDraft()).toEqual(full);
  });

  it("returns nothing when no draft is stored", () => {
    memoryStorage();
    expect(loadDraft()).toBeUndefined();
  });

  it("ignores a value that is not JSON", () => {
    memoryStorage().set("mingle.wizard-draft", "{nope");
    expect(loadDraft()).toBeUndefined();
  });

  it.each([
    ["an unknown step", { ...typed, step: "party" }],
    ["an unknown niche", { ...typed, niche: "zz" }],
    ["an unknown language", { ...typed, language: "de" }],
    ["an unknown activity", { ...typed, enabledModules: ["chess"] }],
    ["a missing field", { ...typed, party: undefined }],
    ["a wrong type", { ...typed, party: { ...typed.party, menu: "Pizza" } }],
    ["an extra field", { ...typed, extra: 1 }],
  ])("ignores a draft with %s", (_name, value) => {
    memoryStorage().set("mingle.wizard-draft", JSON.stringify(value));
    expect(loadDraft()).toBeUndefined();
  });

  it("clears the stored draft", () => {
    const data = memoryStorage();
    saveDraft(typed);
    clearDraft();
    expect(data.size).toBe(0);
    expect(loadDraft()).toBeUndefined();
  });

  it("does nothing, without throwing, when storage is unavailable", () => {
    brokenStorage();
    expect(() => saveDraft(typed)).not.toThrow();
    expect(() => clearDraft()).not.toThrow();
    expect(loadDraft()).toBeUndefined();
  });
});
