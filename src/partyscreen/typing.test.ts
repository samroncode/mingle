import { describe, expect, it } from "vitest";
import { isTyping } from "./typing";

describe("isTyping", () => {
  it("is true for fields the user types in", () => {
    expect(isTyping({ tagName: "INPUT" })).toBe(true);
    expect(isTyping({ tagName: "textarea" })).toBe(true);
    expect(isTyping({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("is false for the page and other elements", () => {
    expect(isTyping(null)).toBe(false);
    expect(isTyping({ tagName: "BODY" })).toBe(false);
    expect(isTyping({ tagName: "BUTTON" })).toBe(false);
  });
});
