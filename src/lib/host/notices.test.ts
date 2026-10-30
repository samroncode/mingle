import { describe, expect, it } from "vitest";
import {
  canSendNotice,
  charactersLeft,
  formatSentTime,
  noticeMaxLength,
} from "./notices";

describe("charactersLeft", () => {
  it("counts down from the limit and goes negative past it", () => {
    expect(charactersLeft("")).toBe(noticeMaxLength);
    expect(charactersLeft("Dinner")).toBe(134);
    expect(charactersLeft("a".repeat(141))).toBe(-1);
  });

  it("ignores spaces around the text, as the server does", () => {
    expect(charactersLeft("  Dinner  ")).toBe(134);
  });
});

describe("canSendNotice", () => {
  it("refuses empty and whitespace-only text", () => {
    expect(canSendNotice("")).toBe(false);
    expect(canSendNotice("   \n ")).toBe(false);
  });

  it("accepts 140 characters and refuses 141", () => {
    expect(canSendNotice("a".repeat(140))).toBe(true);
    expect(canSendNotice("a".repeat(141))).toBe(false);
  });
});

describe("formatSentTime", () => {
  it("shows hours and minutes", () => {
    expect(formatSentTime("2026-10-30T12:05:00Z", "en")).toMatch(/\d{1,2}:05/);
  });
});
