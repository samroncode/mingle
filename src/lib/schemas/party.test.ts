import { describe, expect, it } from "vitest";
import { PartySchema, normalizeMusicUrl, partyLimits } from "./party.ts";

const stored = (musicUrl: string) => {
  const result = PartySchema.safeParse({ musicUrl });
  return result.success ? result.data.musicUrl : undefined;
};

describe("music link", () => {
  it.each([
    ["https://open.spotify.com/jam/x", "https://open.spotify.com/jam/x"],
    ["HTTPS://open.spotify.com/jam/x", "https://open.spotify.com/jam/x"],
    ["  open.spotify.com/jam/x  ", "https://open.spotify.com/jam/x"],
    ["www.spotify.com/jam/x", "https://www.spotify.com/jam/x"],
    ["spotify.link/abc?si=1#t", "https://spotify.link/abc?si=1#t"],
    ["http://open.spotify.com/x", "https://open.spotify.com/x"],
    ["HTTP://open.spotify.com/x", "https://open.spotify.com/x"],
    ["//open.spotify.com/x", "https://open.spotify.com/x"],
    ["open.spotify.com/jam/x\n", "https://open.spotify.com/jam/x"],
    ["open.spotify.com/jam/x​", "https://open.spotify.com/jam/x"],
    ["open.spotify.com/jam/​x y", "https://open.spotify.com/jam/xy"],
  ])("stores %j as %j", (input, expected) => {
    expect(stored(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>",
    "mailto:a@b.se",
    "tel:0701234567",
    "file:///etc/passwd",
    "ftp://x.se",
    "vbscript:x",
    "blob:https://x.se/1",
    "https://hello",
    "hello",
    "https://user:pass@open.spotify.com/x",
    "just some words",
    `open.spotify.com/${"a".repeat(partyLimits.musicUrl)}`,
  ])("rejects %j", (input) => {
    expect(PartySchema.safeParse({ musicUrl: input }).success).toBe(false);
  });

  it("does not touch the scheme of unsafe links", () => {
    expect(normalizeMusicUrl("javascript:alert(1)")).toBe(
      "javascript:alert(1)",
    );
  });

  it("is idempotent", () => {
    for (const input of [
      "open.spotify.com/x",
      "http://a.se/b",
      "//a.se/b",
      "javascript:1",
    ]) {
      const once = normalizeMusicUrl(input);
      expect(normalizeMusicUrl(once)).toBe(once);
    }
  });

  it("leaves the music link out when it is absent", () => {
    expect(PartySchema.safeParse({}).success).toBe(true);
  });
});
