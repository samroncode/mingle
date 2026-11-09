import { describe, expect, it } from "vitest";
import {
  CompetitionNameSchema,
  CompetitionsSchema,
  competitionsLimits,
} from "./competitions";
import {
  CreateEventRequestSchema,
  UpdateCompetitionsRequestSchema,
} from "./host-actions";

describe("the competition name", () => {
  it("is trimmed and 1 to 40 characters", () => {
    expect(CompetitionNameSchema.parse("  Ping pong ")).toBe("Ping pong");
    expect(
      CompetitionNameSchema.safeParse("x".repeat(competitionsLimits.name))
        .success,
    ).toBe(true);
    expect(
      CompetitionNameSchema.safeParse("x".repeat(competitionsLimits.name + 1))
        .success,
    ).toBe(false);
    expect(CompetitionNameSchema.safeParse("   ").success).toBe(false);
    expect(CompetitionNameSchema.safeParse("").success).toBe(false);
  });
});

describe("the competitions list", () => {
  const names = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ name: `Game ${i}` }));

  it("holds at most five", () => {
    expect(CompetitionsSchema.safeParse(names(5)).success).toBe(true);
    expect(CompetitionsSchema.safeParse(names(6)).success).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(
      CompetitionsSchema.safeParse([{ name: "Darts", score: 3 }]).success,
    ).toBe(false);
  });
});

describe("create_event with competitions", () => {
  const base = {
    action: "create_event",
    niche: "aw",
    language: "en",
    party: {},
  };

  it("accepts competitions with Competitions switched on", () => {
    expect(
      CreateEventRequestSchema.safeParse({
        ...base,
        enabledModules: ["competitions"],
        competitions: [{ name: "Darts" }],
      }).success,
    ).toBe(true);
  });

  it("rejects competitions with Competitions switched off", () => {
    expect(
      CreateEventRequestSchema.safeParse({
        ...base,
        enabledModules: ["quiz"],
        competitions: [{ name: "Darts" }],
      }).success,
    ).toBe(false);
  });
});

describe("update_competitions", () => {
  const link = { action: "update_competitions", code: "ABCDEF", key: "k" };
  const key = "A".repeat(43);
  const id = "3f0c7a0e-6a52-4a37-9c6e-6a9f0b7d1c11";
  const parse = (change: unknown) =>
    UpdateCompetitionsRequestSchema.safeParse({ ...link, key, change });

  it("accepts add, rename, remove and reorder", () => {
    expect(parse({ type: "add", name: "Darts" }).success).toBe(true);
    expect(parse({ type: "rename", id, name: "Darts" }).success).toBe(true);
    expect(parse({ type: "remove", id }).success).toBe(true);
    expect(parse({ type: "reorder", ids: [id] }).success).toBe(true);
  });

  it("rejects a bad name, a bad id and an unknown change", () => {
    expect(parse({ type: "add", name: " " }).success).toBe(false);
    expect(parse({ type: "add", name: "x".repeat(41) }).success).toBe(false);
    expect(parse({ type: "remove", id: "nope" }).success).toBe(false);
    expect(parse({ type: "reorder", ids: Array(6).fill(id) }).success).toBe(
      false,
    );
    expect(parse({ type: "swap" }).success).toBe(false);
  });
});
