import { describe, expect, it, vi } from "vitest";
import type { Party } from "@/lib/schemas/party";
import { partyToForm, savePartyEdit } from "./party-edit";

const target = { code: "ABCD", key: "k" };
const saved: Party = {
  welcome: "Hi",
  menu: ["Pizza"],
  schedule: [{ time: "19:00", title: "Dinner" }],
  wifi: { ssid: "Home", password: "pw" },
  musicUrl: "https://open.spotify.com/jam/1",
};

describe("partyToForm", () => {
  it("round-trips the saved content through the form", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: {} });
    await savePartyEdit(partyToForm(saved), target, send);
    expect(send).toHaveBeenCalledWith({ ...target, party: saved });
  });

  it("gives empty fields for an empty party", () => {
    expect(partyToForm({})).toMatchObject({
      welcome: "",
      menu: [],
      wifiSsid: "",
    });
  });
});

describe("savePartyEdit", () => {
  it("sends the whole object without a cleared part", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const form = { ...partyToForm(saved), wifiSsid: "", wifiPassword: "" };
    expect(await savePartyEdit(form, target, send)).toEqual({ ok: true });
    const sent = send.mock.calls[0]?.[0] as { party: Party };
    expect(sent.party).not.toHaveProperty("wifi");
    expect(sent.party.welcome).toBe("Hi");
  });

  it("sends nothing while a field is invalid", async () => {
    const send = vi.fn();
    const form = { ...partyToForm(saved), musicUrl: "not a url" };
    expect(await savePartyEdit(form, target, send)).toEqual({
      ok: false,
      invalid: ["musicUrl"],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it.each(["rate_limited", "invalid_request", "network_error"] as const)(
    "returns %s from the server",
    async (error) => {
      const send = vi.fn().mockResolvedValue({ ok: false, error });
      expect(await savePartyEdit(partyToForm(saved), target, send)).toEqual({
        ok: false,
        error,
      });
    },
  );
});
