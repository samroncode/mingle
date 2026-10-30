import { describe, expect, it, vi } from "vitest";
import type { Party } from "@/lib/schemas/party";
import { partyLimits } from "@/lib/schemas/party";
import { saveWinners, winnerProblems } from "./winners-edit";

const target = { code: "ABCD", key: "k" };
const saved: Party = {
  welcome: "Hi",
  menu: ["Pizza"],
  schedule: [{ time: "19:00", title: "Dinner" }],
  wifi: { ssid: "Home", password: "pw" },
  musicUrl: "https://open.spotify.com/jam/1",
  winners: [{ title: "Darts", name: "Anna" }],
};
const ok = () => vi.fn().mockResolvedValue({ ok: true, data: {} });
const sentParty = (send: ReturnType<typeof ok>) =>
  (send.mock.calls[0]?.[0] as { party: Party }).party;

describe("winnerProblems", () => {
  it("accepts a title and a name", () => {
    expect(winnerProblems({ title: "Darts", name: "Anna" })).toEqual([]);
  });

  it("refuses empty and over-long text, trimmed", () => {
    const long = "x".repeat(partyLimits.winnerText + 1);
    expect(winnerProblems({ title: "  ", name: long })).toEqual([
      "title",
      "name",
    ]);
  });
});

describe("saveWinners", () => {
  it("changes only the winners, never the Party screen fields", async () => {
    const send = ok();
    await saveWinners(
      { kind: "add", winner: { title: " Costume ", name: "Bo" } },
      saved,
      target,
      send,
    );
    expect(sentParty(send)).toEqual({
      ...saved,
      winners: [
        { title: "Darts", name: "Anna" },
        { title: "Costume", name: "Bo" },
      ],
    });
  });

  it("edits and deletes by position", async () => {
    const edit = ok();
    await saveWinners(
      { kind: "edit", index: 0, winner: { title: "Darts", name: "Cleo" } },
      saved,
      target,
      edit,
    );
    expect(sentParty(edit).winners).toEqual([{ title: "Darts", name: "Cleo" }]);

    const del = ok();
    await saveWinners({ kind: "delete", index: 0 }, saved, target, del);
    expect(sentParty(del)).not.toHaveProperty("winners");
    expect(sentParty(del).welcome).toBe("Hi");
  });

  it("hides and shows the slide without losing the list", async () => {
    const hide = ok();
    await saveWinners({ kind: "hidden", hidden: true }, saved, target, hide);
    expect(sentParty(hide)).toEqual({ ...saved, winnersHidden: true });

    const show = ok();
    await saveWinners(
      { kind: "hidden", hidden: false },
      { ...saved, winnersHidden: true },
      target,
      show,
    );
    expect(sentParty(show)).toEqual(saved);
  });

  it("keeps the hidden flag when a winner is added", async () => {
    const send = ok();
    await saveWinners(
      { kind: "add", winner: { title: "A", name: "B" } },
      { ...saved, winnersHidden: true },
      target,
      send,
    );
    expect(sentParty(send).winnersHidden).toBe(true);
  });

  it("refuses an invalid winner without sending", async () => {
    const send = ok();
    expect(
      await saveWinners(
        { kind: "add", winner: { title: "", name: "Bo" } },
        saved,
        target,
        send,
      ),
    ).toEqual({ ok: false, problems: ["title"] });
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a ninth winner", async () => {
    const send = ok();
    const full = Array.from({ length: partyLimits.winners }, (_, i) => ({
      title: `T${i}`,
      name: "N",
    }));
    expect(
      await saveWinners(
        { kind: "add", winner: { title: "A", name: "B" } },
        { winners: full },
        target,
        send,
      ),
    ).toEqual({ ok: false, problems: ["full"] });
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: "ended" });
    expect(
      await saveWinners({ kind: "delete", index: 0 }, saved, target, send),
    ).toEqual({ ok: false, error: "ended" });
  });
});
