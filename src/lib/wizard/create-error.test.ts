import { describe, expect, it } from "vitest";
import { createErrorKey } from "./create-error";

describe("createErrorKey", () => {
  it("maps known codes to their own message", () => {
    expect(createErrorKey("network_error")).toBe("errors.create.network_error");
    expect(createErrorKey("rate_limited")).toBe("errors.create.rate_limited");
    expect(createErrorKey("captcha_failed")).toBe("captcha.failed");
    expect(createErrorKey("invalid_request")).toBe(
      "errors.create.invalid_request",
    );
  });

  it("falls back to the generic message for any other code", () => {
    expect(createErrorKey("not_authenticated")).toBe(
      "errors.create.internal_error",
    );
    expect(createErrorKey("internal_error")).toBe(
      "errors.create.internal_error",
    );
  });
});
