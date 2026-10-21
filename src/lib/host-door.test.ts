import { describe, expect, it } from "vitest";
import { hostDoorErrorKey, readHostLink } from "./host-door";

describe("hostDoorErrorKey", () => {
  it("shows the same bad-link message for a bad link and a refused claim", () => {
    expect(hostDoorErrorKey("bad_link")).toBe("hostDoor.badLink");
    expect(hostDoorErrorKey("not_authorized")).toBe("hostDoor.badLink");
    expect(hostDoorErrorKey("invalid_request")).toBe("hostDoor.badLink");
  });

  it("gives rate limits and network errors their own message", () => {
    expect(hostDoorErrorKey("rate_limited")).toBe("hostDoor.rate_limited");
    expect(hostDoorErrorKey("network_error")).toBe("hostDoor.network_error");
  });

  it("falls back to a generic message for anything else", () => {
    expect(hostDoorErrorKey("internal_error")).toBe("hostDoor.internal_error");
    expect(hostDoorErrorKey("not_authenticated")).toBe(
      "hostDoor.internal_error",
    );
  });
});

const key = "Ab_-".repeat(10) + "xyz";

describe("readHostLink", () => {
  it("returns the code and key of a well-formed host link", () => {
    expect(readHostLink("ABC234", `#key=${key}`)).toEqual({
      code: "ABC234",
      key,
    });
  });

  it("rejects a link without a key", () => {
    expect(readHostLink("ABC234", "")).toBeUndefined();
    expect(readHostLink("ABC234", "#")).toBeUndefined();
  });

  it("rejects a malformed key", () => {
    expect(readHostLink("ABC234", "#key=short")).toBeUndefined();
    expect(readHostLink("ABC234", `#key=${key}!`)).toBeUndefined();
  });

  it("rejects an invalid or missing code", () => {
    expect(readHostLink("ABC23", `#key=${key}`)).toBeUndefined();
    expect(readHostLink("ABC0O1", `#key=${key}`)).toBeUndefined();
    expect(readHostLink(undefined, `#key=${key}`)).toBeUndefined();
  });
});
