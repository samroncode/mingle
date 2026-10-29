import { describe, expect, it } from "vitest";
import { getNiche } from "@/niches";
import { initialDraft, sliceSummaries, wizardReducer } from "./state";

describe("sliceSummaries", () => {
  it("gives one line per activity that is switched on, in step order", () => {
    const draft = initialDraft("en");
    const lines = sliceSummaries(draft);
    expect(lines.map((line) => line.step)).toEqual(
      ["quiz", "awards"].filter((id) =>
        draft.enabledModules.includes(id as "quiz" | "awards"),
      ),
    );
    for (const line of lines) expect(line.key).toMatch(/^wizard\.summary\./);
  });

  it("leaves out an activity that is switched off", () => {
    const draft = wizardReducer(initialDraft("en"), {
      type: "toggle_module",
      module: "quiz",
    });
    expect(sliceSummaries(draft).map((line) => line.step)).not.toContain(
      "quiz",
    );
  });

  it("counts the items the request would carry", () => {
    const draft = wizardReducer(initialDraft("en"), {
      type: "quiz",
      action: {
        type: "seed",
        ids: getNiche("aw")
          .quiz.slice(0, 3)
          .map((q) => q.id),
      },
    });
    const quiz = sliceSummaries(draft).find((line) => line.step === "quiz");
    expect(quiz?.key).toBe("wizard.summary.quizQuestions");
    expect(quiz?.count).toBe(3);
  });
});
