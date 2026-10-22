import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PickItem, PickListAction } from "@/lib/wizard/pick-list";

/** The texts of a pick list, already translated by the module's step. */
export interface PickListLabels {
  count: string;
  empty: string;
  addOwn: string;
  full: string;
  more: string;
  add: string;
  moveUp: (n: number) => string;
  moveDown: (n: number) => string;
  remove: (n: number) => string;
}

/** A ready-made item the host has not picked yet. */
export interface AvailableItem {
  id: string;
  content: ReactNode;
  addLabel: string;
}

/** Move up, move down and remove for one item. */
function ItemControls({
  index,
  count,
  labels,
  dispatch,
}: {
  index: number;
  count: number;
  labels: PickListLabels;
  dispatch: (action: PickListAction<never>) => void;
}) {
  const n = index + 1;
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.moveUp(n)}
        disabled={index === 0}
        onClick={() => dispatch({ type: "move", from: index, to: index - 1 })}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.moveDown(n)}
        disabled={index === count - 1}
        onClick={() => dispatch({ type: "move", from: index, to: index + 1 })}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={labels.remove(n)}
        onClick={() => dispatch({ type: "remove", index })}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

interface PickListEditorProps<O> {
  /** Used to make ids unique when a page holds more than one list. */
  id: string;
  items: PickItem<O>[];
  seeded: boolean;
  limit: number;
  labels: PickListLabels;
  /** Ready-made items not yet picked. */
  available: AvailableItem[];
  /** The content of a picked item; null hides an item that no longer exists. */
  renderItem: (item: PickItem<O>, index: number) => ReactNode;
  dispatch: (action: PickListAction<O>) => void;
}

/**
 * The shared wizard step for a module: the picked items in order, a button for
 * the host's own, and the ready-made ones still to add. The module supplies
 * how an item looks.
 */
export function PickListEditor<O>({
  id,
  items,
  seeded,
  limit,
  labels,
  available,
  renderItem,
  dispatch,
}: PickListEditorProps<O>) {
  const full = items.length >= limit;
  const moreId = `${id}-more`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{labels.count}</p>

      {items.length === 0 && seeded && (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      )}

      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item.kind === "own" ? item.key : item.id}>
            <Card className="flex-row items-start gap-1 p-3">
              <span className="w-6 shrink-0 pt-0.5 text-sm text-muted-foreground">
                {index + 1}.
              </span>
              {renderItem(item, index)}
              <ItemControls
                index={index}
                count={items.length}
                labels={labels}
                dispatch={dispatch}
              />
            </Card>
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        size="lg"
        disabled={full}
        onClick={() => dispatch({ type: "add_own", key: crypto.randomUUID() })}
      >
        {labels.addOwn}
      </Button>
      {full && <p className="text-sm text-muted-foreground">{labels.full}</p>}

      {available.length > 0 && (
        <section aria-labelledby={moreId} className="space-y-2">
          <h2 id={moreId} className="text-lg font-semibold">
            {labels.more}
          </h2>
          <ul className="space-y-2">
            {available.map((entry) => (
              <li key={entry.id}>
                <Card className="flex-row items-start gap-2 p-3">
                  {entry.content}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={full}
                    aria-label={entry.addLabel}
                    onClick={() =>
                      dispatch({ type: "add_builtin", id: entry.id })
                    }
                  >
                    {labels.add}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
