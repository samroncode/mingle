import { describe, expect, it } from "vitest";
import { CreateEventResponseSchema } from "@/lib/schemas/host-actions";
import { toHostActionResult } from "./host-actions";

const KEY = "dGhpcy1pcy1hLTMyLWJ5dGUta2V5LWZvci10ZXN0cyE";

describe("toHostActionResult", () => {
  it("returns the data of a valid success response", () => {
    expect(
      toHostActionResult(CreateEventResponseSchema, {
        kind: "success",
        body: { code: "AB3XYZ", key: KEY },
      }),
    ).toEqual({ ok: true, data: { code: "AB3XYZ", key: KEY } });
  });

  it("treats a success response of the wrong shape as internal_error", () => {
    expect(
      toHostActionResult(CreateEventResponseSchema, {
        kind: "success",
        body: { code: "AB3XYZ" },
      }),
    ).toEqual({ ok: false, error: "internal_error" });
  });

  it.each([
    "invalid_request",
    "not_authenticated",
    "not_authorized",
    "origin_not_allowed",
    "payload_too_large",
    "rate_limited",
  ] as const)("passes on the %s error code", (code) => {
    expect(
      toHostActionResult(CreateEventResponseSchema, {
        kind: "http_error",
        body: { error: code },
      }),
    ).toEqual({ ok: false, error: code });
  });

  it.each([
    ["an unknown code", { error: "drop_tables" }],
    ["free text", { error: "Something went wrong" }],
    ["a gateway message", { message: "Bad Gateway" }],
    ["no body", undefined],
  ])("maps an error with %s to internal_error", (_, body) => {
    expect(
      toHostActionResult(CreateEventResponseSchema, {
        kind: "http_error",
        body,
      }),
    ).toEqual({ ok: false, error: "internal_error" });
  });

  it("maps a request that never got an answer to network_error", () => {
    expect(
      toHostActionResult(CreateEventResponseSchema, { kind: "network_error" }),
    ).toEqual({ ok: false, error: "network_error" });
  });
});
