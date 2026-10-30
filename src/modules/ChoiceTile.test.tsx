import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoiceTile } from "./ChoiceTile";
import { choiceState, type ChoiceState } from "./choiceState";

function tile(state: ChoiceState) {
  return renderToStaticMarkup(
    <ChoiceTile
      fill="coral"
      label="Canberra"
      leading={<span>C</span>}
      state={state}
      onPress={() => {}}
    />,
  );
}

describe("ChoiceTile", () => {
  it("announces only the chosen tile as pressed", () => {
    expect(tile("chosen")).toContain('aria-pressed="true"');
    expect(tile("idle")).toContain('aria-pressed="false"');
    expect(tile("other-chosen")).toContain('aria-pressed="false"');
  });

  it("keeps every tile pressable, with its label and leading content", () => {
    for (const state of ["idle", "chosen", "other-chosen"] as const) {
      const html = tile(state);
      expect(html).toMatch(/^<button type="button"/);
      expect(html).not.toContain("disabled");
      expect(html).toContain("Canberra");
      expect(html).toContain("<span>C</span>");
    }
  });
});

describe("choiceState", () => {
  it("is idle before any answer, then chosen or other-chosen", () => {
    expect(choiceState(false, false)).toBe("idle");
    expect(choiceState(true, true)).toBe("chosen");
    expect(choiceState(false, true)).toBe("other-chosen");
  });
});
