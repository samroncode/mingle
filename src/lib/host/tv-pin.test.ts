import { describe, expect, it, vi } from "vitest";
import type { Party } from "@/lib/schemas/party";
import { PartySchema } from "@/lib/schemas/party";
import { saveTvPin, withTvPin } from "./tv-pin";

const saved: Party = {
  welcome: "Hi",
  menu: ["Pizza"],
  winners: [{ title: "Darts", name: "Anna" }],
};

describe("withTvPin", () => {
  it("sets the pin and keeps everything else", () => {
    expect(withTvPin(saved, "menu")).toEqual({ ...saved, tvPin: "menu" });
  });

  it("replaces an old pin and removes it for undefined", () => {
    const pinned = { ...saved, tvPin: "wifi" };
    expect(withTvPin(pinned, "menu").tvPin).toBe("menu");
    expect("tvPin" in withTvPin(pinned, undefined)).toBe(false);
  });

  it("produces content the shared schema accepts", () => {
    expect(PartySchema.safeParse(withTvPin(saved, "menu")).success).toBe(true);
  });
});

describe("saveTvPin", () => {
  it("sends the whole party with the pin", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const result = await saveTvPin(
      "menu",
      saved,
      { code: "ABCD", key: "k" },
      send,
    );
    expect(result).toEqual({ ok: true });
    expect(send).toHaveBeenCalledWith({
      code: "ABCD",
      key: "k",
      party: { ...saved, tvPin: "menu" },
    });
  });

  it("passes a failure on", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "network_error" });
    expect(
      await saveTvPin(undefined, saved, { code: "A", key: "k" }, send),
    ).toEqual({ ok: false, error: "network_error" });
  });
});
