import { describe, expect, it } from "vitest";
import {
  ClearWheelSpinsRequestSchema,
  SetWheelAutoTakeOffRequestSchema,
  SpinWheelRequestSchema,
  UpdateWheelRequestSchema,
  WheelChangeSchema,
} from "./host-actions";
import { WheelLabelSchema, wheelLimits } from "./wheel";

const id = "6f1d2e0a-8f3c-4c52-9a43-2f1b7b1c9e10";
const link = { code: "ABCDEF", key: "a".repeat(43) };

describe("WheelLabelSchema", () => {
  it("trims and accepts 1 to 30 characters", () => {
    expect(WheelLabelSchema.parse("  Take a shot ")).toBe("Take a shot");
    expect(WheelLabelSchema.safeParse("x".repeat(30)).success).toBe(true);
  });

  it("refuses blank text and more than 30 characters", () => {
    expect(WheelLabelSchema.safeParse("   ").success).toBe(false);
    expect(WheelLabelSchema.safeParse("x".repeat(31)).success).toBe(false);
  });
});

describe("WheelChangeSchema", () => {
  it("accepts each kind of change", () => {
    for (const change of [
      { type: "add_guests", ids: [id] },
      { type: "add_custom", label: "Pick a song" },
      { type: "take_off", id },
      { type: "put_back", id },
      { type: "remove", id },
    ]) {
      expect(WheelChangeSchema.safeParse(change).success).toBe(true);
    }
  });

  it("refuses no guests, more guests than the wheel holds and extra fields", () => {
    expect(
      WheelChangeSchema.safeParse({ type: "add_guests", ids: [] }).success,
    ).toBe(false);
    expect(
      WheelChangeSchema.safeParse({
        type: "add_guests",
        ids: Array.from({ length: wheelLimits.perEvent + 1 }, () => id),
      }).success,
    ).toBe(false);
    expect(
      WheelChangeSchema.safeParse({ type: "take_off", id, extra: 1 }).success,
    ).toBe(false);
    expect(
      WheelChangeSchema.safeParse({ type: "take_off", id: "x" }).success,
    ).toBe(false);
  });
});

describe("UpdateWheelRequestSchema", () => {
  it("needs the host link", () => {
    const change = { type: "take_off", id };
    expect(
      UpdateWheelRequestSchema.safeParse({
        action: "update_wheel",
        ...link,
        change,
      }).success,
    ).toBe(true);
    expect(
      UpdateWheelRequestSchema.safeParse({ action: "update_wheel", change })
        .success,
    ).toBe(false);
  });
});

describe("the spin requests", () => {
  it("need the host link and nothing else", () => {
    for (const schema of [
      SpinWheelRequestSchema,
      ClearWheelSpinsRequestSchema,
    ]) {
      const action =
        schema === SpinWheelRequestSchema ? "spin_wheel" : "clear_wheel_spins";
      expect(schema.safeParse({ action, ...link }).success).toBe(true);
      expect(schema.safeParse({ action }).success).toBe(false);
      expect(schema.safeParse({ action, ...link, extra: 1 }).success).toBe(
        false,
      );
    }
  });

  it("takes a boolean for the automatic take-off", () => {
    const request = { action: "set_wheel_auto_take_off", ...link };
    expect(
      SetWheelAutoTakeOffRequestSchema.safeParse({ ...request, enabled: true })
        .success,
    ).toBe(true);
    for (const enabled of ["true", 1, null, undefined]) {
      expect(
        SetWheelAutoTakeOffRequestSchema.safeParse({ ...request, enabled })
          .success,
      ).toBe(false);
    }
  });
});
