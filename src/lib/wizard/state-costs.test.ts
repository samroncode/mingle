import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateEventRequestSchema } from "@/lib/schemas/host-actions";
import { loadDraft, saveDraft } from "./draft-storage";
import {
  firstInvalidDraftStep,
  initialDraft,
  stepIsInvalid,
  stepsFor,
  toCreateInput,
  toCreateRequest,
  wizardReducer,
  type WizardAction,
  type WizardDraft,
} from "./state";
import type { CostsAction } from "./costs";

function run(draft: WizardDraft, ...actions: WizardAction[]) {
  return actions.reduce(wizardReducer, draft);
}

const costs = (action: CostsAction): WizardAction => ({
  type: "costs",
  action,
});

const switchedOn = () =>
  run(initialDraft("en"), costs({ type: "set_enabled", enabled: true }));

const filledIn = () =>
  run(
    switchedOn(),
    costs({ type: "set_payee", payeeName: "Sam" }),
    costs({ type: "set_swish", swishNumber: "070-123 45 67" }),
  );

describe("the shared costs step", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is off by default, so nothing about costs is in the steps or the request", () => {
    const draft = initialDraft("en");
    expect(draft.costs.enabled).toBe(false);
    expect(stepsFor(draft)).not.toContain("costs");
    expect(toCreateInput(draft)).not.toHaveProperty("costs");
  });

  it("comes after the activity steps and before the welcome text once on", () => {
    const steps = stepsFor(switchedOn());
    expect(steps[steps.indexOf("hottakes") + 1]).toBe("costs");
    expect(steps[steps.indexOf("costs") + 1]).toBe("welcome");
    expect(
      run(switchedOn(), { type: "go_to", step: "costs" }, { type: "next" })
        .step,
    ).toBe("welcome");
  });

  it("needs a payee name and a Swedish mobile number before Next", () => {
    expect(stepIsInvalid(switchedOn(), "costs")).toBe(true);
    expect(
      stepIsInvalid(
        run(switchedOn(), costs({ type: "set_payee", payeeName: "Sam" })),
        "costs",
      ),
    ).toBe(true);
    expect(stepIsInvalid(filledIn(), "costs")).toBe(false);
    expect(
      stepIsInvalid(
        run(filledIn(), costs({ type: "set_swish", swishNumber: "12345" })),
        "costs",
      ),
    ).toBe(true);
  });

  it("is never invalid while switched off, however much was typed", () => {
    const draft = run(
      filledIn(),
      costs({ type: "set_swish", swishNumber: "12345" }),
      costs({ type: "set_enabled", enabled: false }),
    );
    expect(stepIsInvalid(draft, "costs")).toBe(false);
    expect(firstInvalidDraftStep(draft)).toBeUndefined();
  });

  it("checks every purchase with the control panel's rules", () => {
    const withPurchase = run(filledIn(), costs({ type: "add_purchase" }));
    const key = withPurchase.costs.purchases[0]?.key ?? "";
    expect(stepIsInvalid(withPurchase, "costs")).toBe(true);
    const named = run(
      withPurchase,
      costs({ type: "change_purchase", key, part: { name: "Drinks" } }),
    );
    expect(stepIsInvalid(named, "costs")).toBe(true);
    for (const price of ["0", "12,5", "abc", "100001"]) {
      expect(
        stepIsInvalid(
          run(named, costs({ type: "change_purchase", key, part: { price } })),
          "costs",
        ),
      ).toBe(true);
    }
    expect(
      stepIsInvalid(
        run(
          named,
          costs({ type: "change_purchase", key, part: { price: "1 200" } }),
        ),
        "costs",
      ),
    ).toBe(false);
  });

  it("sends the costs normalised, with purchases in order and no sharers", () => {
    let draft = filledIn();
    draft = run(draft, costs({ type: "add_purchase" }));
    draft = run(draft, costs({ type: "add_purchase" }));
    const [a, b] = draft.costs.purchases;
    draft = run(
      draft,
      costs({
        type: "change_purchase",
        key: a?.key ?? "",
        part: { name: " Drinks ", price: "450" },
      }),
      costs({
        type: "change_purchase",
        key: b?.key ?? "",
        part: { name: "Pizza", price: "1 200" },
      }),
    );
    const request = toCreateRequest(draft);
    expect(request.costs).toEqual({
      payeeName: "Sam",
      swishNumber: "46701234567",
      purchases: [
        { name: "Drinks", price: 450 },
        { name: "Pizza", price: 1200 },
      ],
    });
    expect(CreateEventRequestSchema.safeParse(request).success).toBe(true);
  });

  it("sends the payee and number with no purchases when none were added", () => {
    expect(toCreateRequest(filledIn()).costs?.purchases).toEqual([]);
  });

  it("removes a purchase by key", () => {
    let draft = run(
      filledIn(),
      costs({ type: "add_purchase" }),
      costs({ type: "add_purchase" }),
    );
    const [a, b] = draft.costs.purchases;
    draft = run(draft, costs({ type: "remove_purchase", key: a?.key ?? "" }));
    expect(draft.costs.purchases.map((p) => p.key)).toEqual([b?.key]);
  });

  it("skipping the step switches shared costs off and moves to the next step", () => {
    const draft = run(
      filledIn(),
      { type: "go_to", step: "costs" },
      {
        type: "skip",
      },
    );
    expect(draft.step).toBe("welcome");
    expect(draft.costs.enabled).toBe(false);
    expect(draft.costs.payeeName).toBe("");
    expect(stepsFor(draft)).not.toContain("costs");
    expect(toCreateInput(draft)).not.toHaveProperty("costs");
  });

  it("keeps what was typed when switched off and on again", () => {
    const draft = run(
      filledIn(),
      costs({ type: "set_enabled", enabled: false }),
      costs({ type: "set_enabled", enabled: true }),
    );
    expect(draft.costs.payeeName).toBe("Sam");
  });

  it("survives a reload", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    });
    const draft = run(filledIn(), costs({ type: "add_purchase" }));
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
  });
});
