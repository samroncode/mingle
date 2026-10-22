/** An item the host wrote, as typed: `O` holds its fields, `key` tells it apart. */
export type OwnItem<O> = { kind: "own"; key: string } & O;

/** One item in a pick list: a ready-made one by id, or one the host wrote. */
export type PickItem<O> = { kind: "builtin"; id: string } | OwnItem<O>;

/**
 * What the host has picked so far for a module, in the order it will be
 * played. Built-in items are kept by id, so they follow the event language.
 * Plain data, so it can be saved as JSON.
 */
export interface PickList<O> {
  /** False until the default pick has been made, which happens only once. */
  seeded: boolean;
  items: PickItem<O>[];
}

export type PickListAction<O> =
  | { type: "seed"; ids: string[] }
  | { type: "add_builtin"; id: string }
  | { type: "add_own"; key: string }
  | { type: "edit_own"; key: string; change: Partial<O> }
  | { type: "move"; from: number; to: number }
  | { type: "remove"; index: number };

/** What differs between modules: the size limit and an empty own item. */
export interface PickListRules<O> {
  limit: number;
  blank: () => O;
}

export function emptyPickList<O>(): PickList<O> {
  return { seeded: false, items: [] };
}

/** Picks `size` of the ids at random; `random` is injectable. */
export function pickDefaultIds(
  allIds: readonly string[],
  size: number,
  random: () => number = Math.random,
): string[] {
  const ids = [...allIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = ids[i];
    ids[i] = ids[j] as string;
    ids[j] = swap as string;
  }
  return ids.slice(0, size);
}

function ownItems<O>(list: PickList<O>): PickItem<O>[] {
  return list.items.filter((item) => item.kind === "own");
}

/**
 * After the niche changed: the old niche's items no longer exist, so they go,
 * and the default pick is made again when the step is next reached. The
 * host's own items stay.
 */
export function resetBuiltinItems<O>(list: PickList<O>): PickList<O> {
  return { seeded: false, items: ownItems(list) };
}

function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function pickListReducer<O>(
  list: PickList<O>,
  action: PickListAction<O>,
  rules: PickListRules<O>,
): PickList<O> {
  const full = list.items.length >= rules.limit;
  switch (action.type) {
    case "seed": {
      if (list.seeded) return list;
      const picked: PickItem<O>[] = action.ids.map((id) => ({
        kind: "builtin",
        id,
      }));
      return {
        seeded: true,
        items: [...picked, ...ownItems(list)].slice(0, rules.limit),
      };
    }
    case "add_builtin": {
      const present = list.items.some(
        (item) => item.kind === "builtin" && item.id === action.id,
      );
      if (present || full) return list;
      return {
        ...list,
        items: [...list.items, { kind: "builtin", id: action.id }],
      };
    }
    case "add_own":
      if (full) return list;
      return {
        ...list,
        items: [
          ...list.items,
          { kind: "own", key: action.key, ...rules.blank() },
        ],
      };
    case "edit_own":
      return {
        ...list,
        items: list.items.map((item) =>
          item.kind === "own" && item.key === action.key
            ? { ...item, ...action.change }
            : item,
        ),
      };
    case "move":
      return { ...list, items: moveItem(list.items, action.from, action.to) };
    case "remove":
      return {
        ...list,
        items: list.items.filter((_, index) => index !== action.index),
      };
  }
}
