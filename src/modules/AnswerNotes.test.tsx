import { createInstance } from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import en from "@/i18n/en.json";
import sv from "@/i18n/sv.json";
import { AnswerNotes } from "./AnswerNotes";
import { answeredCount } from "./guestCounts";

function render(language: "en" | "sv", answered: number, total: number) {
  const i18n = createInstance();
  void i18n.init({
    lng: language,
    resources: { en: { translation: en }, sv: { translation: sv } },
    initAsync: false,
  });
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <AnswerNotes answered={answered} total={total} />
    </I18nextProvider>,
  );
}

describe("answeredCount", () => {
  it("counts the guest's own answer even if the count has not caught up", () => {
    expect(answeredCount(0, true)).toBe(1);
    expect(answeredCount(0, false)).toBe(0);
    expect(answeredCount(4, true)).toBe(4);
  });
});

describe("AnswerNotes", () => {
  it("says how many have answered and that the answer can change", () => {
    const html = render("en", 1, 3);
    expect(html).toContain("1 of 3 has answered");
    expect(html).toContain("You can change your answer until the reveal");
  });

  it("uses the plural form for the count in both languages", () => {
    expect(render("en", 1, 3)).toContain("1 of 3 has answered");
    expect(render("en", 2, 3)).toContain("2 of 3 have answered");
    expect(render("sv", 2, 3)).toContain("2 av 3 har svarat");
  });
});
