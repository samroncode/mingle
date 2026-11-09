import { describe, expect, it } from "vitest";
import { competitionsLimits } from "@/lib/schemas/competitions";
import { getNiche } from "@/niches";
import {
  competitionsReducer,
  emptyCompetitions,
  invalidOwnCompetitionKeys,
  toCompetitions,
  type CompetitionsAction,
  type CompetitionsDraft,
} from "./competitions";

function run(list: CompetitionsDraft, ...actions: CompetitionsAction[]) {
  return actions.reduce(competitionsReducer, list);
}

const [first, second] = getNiche("team").competitions;
if (!first || !second) throw new Error("no competitions content");

describe("editing the competitions", () => {
  it("starts empty and seeded: there is no default pick", () => {
    expect(emptyCompetitions).toEqual({ seeded: true, items: [] });
  });

  it("stops at five competitions", () => {
    const full = Array.from({
      length: competitionsLimits.perEvent,
    }).reduce<CompetitionsDraft>(
      (list, _, i) => run(list, { type: "add_own", key: `k${i}` }),
      emptyCompetitions,
    );
    expect(full.items).toHaveLength(5);
    expect(run(full, { type: "add_own", key: "more" })).toEqual(full);
    expect(run(full, { type: "add_builtin", id: first.id })).toEqual(full);
  });

  it("adds a suggestion once", () => {
    const list = run(
      emptyCompetitions,
      { type: "add_builtin", id: first.id },
      { type: "add_builtin", id: first.id },
    );
    expect(list.items).toEqual([{ kind: "builtin", id: first.id }]);
  });
});

describe("toCompetitions", () => {
  it("sends suggestions in the event language and own names trimmed, in order", () => {
    const list = run(
      emptyCompetitions,
      { type: "add_builtin", id: second.id },
      { type: "add_own", key: "k" },
      { type: "edit_own", key: "k", change: { name: "  Kubb final " } },
      { type: "add_builtin", id: first.id },
    );
    expect(toCompetitions("team", "sv", list)).toEqual([
      { name: second.names.sv },
      { name: "Kubb final" },
      { name: first.names.sv },
    ]);
  });

  it("leaves out a suggestion the niche doesn't have", () => {
    const list = run(emptyCompetitions, { type: "add_builtin", id: "x-gone" });
    expect(toCompetitions("team", "en", list)).toEqual([]);
  });
});

describe("invalidOwnCompetitionKeys", () => {
  it("flags blank and too long own names only", () => {
    const list = run(
      emptyCompetitions,
      { type: "add_own", key: "blank" },
      { type: "add_own", key: "long" },
      {
        type: "edit_own",
        key: "long",
        change: { name: "x".repeat(competitionsLimits.name + 1) },
      },
      { type: "add_own", key: "fine" },
      { type: "edit_own", key: "fine", change: { name: "Darts" } },
    );
    expect(invalidOwnCompetitionKeys(list)).toEqual(["blank", "long"]);
  });
});
