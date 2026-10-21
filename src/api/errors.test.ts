import { describe, expect, it } from "vitest";
import { toJoinErrorCode, toRenameErrorCode } from "./errors";

describe("toJoinErrorCode", () => {
  it.each(["not_found", "ended", "name_taken", "invalid_name", "rate_limited"])(
    "passes %s through",
    (code) => {
      expect(toJoinErrorCode(code)).toBe(code);
    },
  );

  it("maps a code it does not know to unknown", () => {
    expect(toJoinErrorCode("something_else")).toBe("unknown");
    expect(toJoinErrorCode(null)).toBe("unknown");
  });
});

describe("toRenameErrorCode", () => {
  it("maps a unique violation on the guest name index to name_taken", () => {
    expect(
      toRenameErrorCode({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "members_guest_name_key"',
      }),
    ).toBe("name_taken");
  });

  it("maps a failed name check to invalid_name", () => {
    expect(
      toRenameErrorCode({
        code: "23514",
        message: 'violates check constraint "members_display_name_check"',
      }),
    ).toBe("invalid_name");
  });

  it("maps anything else to unknown", () => {
    expect(toRenameErrorCode({ code: "XX000", message: "boom" })).toBe(
      "unknown",
    );
  });
});
