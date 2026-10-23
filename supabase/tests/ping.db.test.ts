// The keep-awake workflow calls `ping` with only the publishable key.
import { describe, expect, it } from "vitest";
import { anonymousUser, signedOutClient } from "./helpers";

describe("ping", () => {
  it("answers true for a signed-out client", async () => {
    const { data, error } = await signedOutClient().rpc("ping");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("answers true for a signed-in guest", async () => {
    const user = await anonymousUser();
    const { data, error } = await user.client.rpc("ping");
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});
