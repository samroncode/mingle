import { describe, expect, it } from "vitest";
import {
  emptyPickList,
  pickDefaultIds,
  pickListReducer,
  resetBuiltinItems,
  type PickList,
  type PickListRules,
} from "./pick-list";

interface Note {
  text: string;
}

const rules: PickListRules<Note> = { limit: 3, blank: () => ({ text: "" }) };
const run = (
  list: PickList<Note>,
  ...actions: Parameters<typeof pickListReducer<Note>>[1][]
) => actions.reduce((acc, action) => pickListReducer(acc, action, rules), list);

describe("pickDefaultIds", () => {
  it("takes at most `size` of the ids without repeats", () => {
    const picked = pickDefaultIds(["a", "b", "c", "d"], 2);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
  });
});

describe("pickListReducer", () => {
  it("seeds once, keeps own items and respects the limit", () => {
    const list = run(
      emptyPickList<Note>(),
      { type: "add_own", key: "k" },
      { type: "seed", ids: ["a", "b", "c"] },
      { type: "seed", ids: ["z"] },
    );
    expect(list.items.map((i) => (i.kind === "own" ? i.key : i.id))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("adds, edits, moves and removes", () => {
    const list = run(
      emptyPickList<Note>(),
      { type: "add_builtin", id: "a" },
      { type: "add_builtin", id: "a" },
      { type: "add_own", key: "k" },
      { type: "edit_own", key: "k", change: { text: "hi" } },
      { type: "move", from: 1, to: 0 },
    );
    expect(list.items).toEqual([
      { kind: "own", key: "k", text: "hi" },
      { kind: "builtin", id: "a" },
    ]);
    expect(run(list, { type: "remove", index: 0 }).items).toHaveLength(1);
  });

  it("drops built-in items on reset but keeps own ones", () => {
    const list = run(
      emptyPickList<Note>(),
      { type: "seed", ids: ["a"] },
      { type: "add_own", key: "k" },
    );
    const reset = resetBuiltinItems(list);
    expect(reset.seeded).toBe(false);
    expect(reset.items).toEqual([{ kind: "own", key: "k", text: "" }]);
  });
});
