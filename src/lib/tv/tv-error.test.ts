import { describe, expect, it } from "vitest";
import { tvErrorKey } from "./tv-error";

describe("tvErrorKey", () => {
  it("says the code is wrong or expired for not_found", () => {
    expect(tvErrorKey("not_found")).toBe("tv.errors.not_found");
  });

  it("says to wait for rate limiting", () => {
    expect(tvErrorKey("rate_limited")).toBe("tv.errors.rate_limited");
    expect(tvErrorKey("captcha_failed")).toBe("captcha.failed");
  });

  it("falls back to a general message for anything else", () => {
    expect(tvErrorKey("name_taken")).toBe("tv.errors.unknown");
    expect(tvErrorKey("unknown")).toBe("tv.errors.unknown");
  });
});
