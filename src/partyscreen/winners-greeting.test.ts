import { describe, expect, it } from "vitest";
import type { Party } from "@/lib/schemas/party";
import { newWinners } from "./winners-greeting";

const anna = { title: "Dart tournament", name: "Anna" };
const bo = { title: "Ping pong", name: "Bo" };
const cy = { title: "Best costume", name: "Cy" };

const party = (winners: Party["winners"], hidden = false): Party => ({
  ...(winners && { winners }),
  ...(hidden && { winnersHidden: true }),
});

describe("newWinners", () => {
  it("greets nobody on the first snapshot", () => {
    expect(newWinners(null, party([anna, bo]))).toEqual([]);
  });

  it("greets a winner that was added", () => {
    expect(newWinners(party([anna]), party([anna, bo]))).toEqual([bo]);
    expect(newWinners(party(undefined), party([anna]))).toEqual([anna]);
  });

  it("greets several winners that arrive together", () => {
    expect(newWinners(party([anna]), party([anna, bo, cy]))).toEqual([bo, cy]);
  });

  it("greets nobody for an edit or a delete", () => {
    expect(newWinners(party([anna, bo]), party([anna, cy]))).toEqual([]);
    expect(newWinners(party([anna, bo]), party([anna]))).toEqual([]);
  });

  it("greets nobody while the slide is hidden or when it is shown again", () => {
    expect(newWinners(party([anna]), party([anna, bo], true))).toEqual([]);
    expect(newWinners(party([anna, bo], true), party([anna, bo]))).toEqual([]);
  });
});
