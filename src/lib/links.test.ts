import { describe, expect, it } from "vitest";
import { hostLink, tvAddress } from "./links";

describe("links", () => {
  it("builds the host link with the key in the fragment", () => {
    expect(hostLink("https://mingle.example", "ABC234", "k_e-y")).toBe(
      "https://mingle.example/host/ABC234#key=k_e-y",
    );
  });

  it("builds the TV address", () => {
    expect(tvAddress("https://mingle.example", "ABC234")).toBe(
      "https://mingle.example/tv/ABC234",
    );
  });
});
