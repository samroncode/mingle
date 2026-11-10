import { describe, expect, it } from "vitest";
import { wheelErrorKey } from "./wheel-errors";

describe("wheelErrorKey", () => {
  it("gives the wheel's own wording for its limits and refusals", () => {
    expect(wheelErrorKey("too_many")).toBe(
      "modules.wheel.host.errors.too_many",
    );
    expect(wheelErrorKey("already_added")).toBe(
      "modules.wheel.host.errors.already_added",
    );
    expect(wheelErrorKey("invalid_name")).toBe(
      "modules.wheel.host.errors.invalid_name",
    );
    expect(wheelErrorKey("not_found")).toBe(
      "modules.wheel.host.errors.not_found",
    );
  });

  it("leaves the rest to the panel", () => {
    expect(wheelErrorKey("module_disabled")).toBe(
      "hostPanel.errors.module_disabled",
    );
    expect(wheelErrorKey("rate_limited")).toBe("hostPanel.errors.rate_limited");
  });
});
