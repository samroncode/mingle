import { describe, expect, it } from "vitest";
import {
  guestAddress,
  hostLink,
  hostPath,
  normalizeJoinCode,
  tvAddress,
} from "./links";

describe("links", () => {
  it("builds the host link with the key in the fragment", () => {
    expect(hostLink("https://mingle.example", "ABC234", "k_e-y")).toBe(
      "https://mingle.example/host/ABC234#key=k_e-y",
    );
  });

  it("builds the host link's path for in-app navigation", () => {
    expect(hostPath("ABC234", "k_e-y")).toBe("/host/ABC234#key=k_e-y");
  });

  it("builds the join address guests scan", () => {
    expect(guestAddress("https://mingle.example", "ABC234")).toBe(
      "https://mingle.example/p/ABC234",
    );
  });

  it("upper-cases a typed join code and removes spaces", () => {
    expect(normalizeJoinCode("  abc 234 ")).toBe("ABC234");
  });

  it("gives an empty string for a blank join code", () => {
    expect(normalizeJoinCode("   ")).toBe("");
  });

  it("builds the TV address", () => {
    expect(tvAddress("https://mingle.example", "ABC234")).toBe(
      "https://mingle.example/tv/ABC234",
    );
  });
});
