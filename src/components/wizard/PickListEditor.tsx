import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PickItem, PickListAction } from "@/lib/wizard/pick-list";

/** The texts of a pick list, already translated by the module's step. */
export interface PickListLabels {
  count: string;
  empty: string;
  addOwn: string;
  full: string;
  /** The toggle text, with the number of ready-made items left. */
  more: (count: number) => string;
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
  n,
  count,
  labels,
  dispatch,
}: {
  index: number;
  /** The item's number as shown. */
  n: number;
  count: number;
  labels: PickListLabels;
  dispatch: (action: PickListAction<never>) => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="text-on-paper hover:bg-surface-sunken hover:text-ink"
        aria-label={labels.moveUp(n)}
        disabled={index === 0}
        onClick={() => dispatch({ type: "move", from: index, to: index - 1 })}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-on-paper hover:bg-surface-sunken hover:text-ink"
        aria-label={labels.moveDown(n)}
        disabled={index === count - 1}
        onClick={() => dispatch({ type: "move", from: index, to: index + 1 })}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-on-paper hover:bg-surface-sunken hover:text-ink"
        aria-label={labels.remove(n)}
        onClick={() => dispatch({ type: "remove", index })}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

/**
 * The ready-made items not yet picked, shut by default so the step stays
 * short. The header is the button; the items are slim rows, not cards.
 */
function ReadyMadeList<O>({
  id,
  available,
  full,
  labels,
  dispatch,
}: {
  id: string;
  available: AvailableItem[];
  full: boolean;
  labels: PickListLabels;
  dispatch: (action: PickListAction<O>) => void;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  if (available.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      data-open={open}
      className="rounded-lg border-[length:var(--border-thin)] border-edge bg-paper text-on-paper"
    >
      <h2 id={id}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg p-4 text-left"
        >
          <span className="font-display text-xl font-bold">
            {labels.more(available.length)}
          </span>
          <ChevronDown
            aria-hidden
            className={cn("size-6 shrink-0", open && "rotate-180")}
          />
        </button>
      </h2>
      {open && (
        <ul id={bodyId} className="border-t border-line px-4">
          {available.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 border-b border-line py-3 last:border-b-0"
            >
              {entry.content}
              <Button
                variant="outline"
                size="sm"
                disabled={full}
                aria-label={entry.addLabel}
                onClick={() => dispatch({ type: "add_builtin", id: entry.id })}
              >
                {labels.add}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
  /** The first item's number, when locked items come before the list. */
  firstNumber?: number;
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
  firstNumber = 1,
}: PickListEditorProps<O>) {
  const full = items.length >= limit;
  const moreId = `${id}-more`;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{labels.count}</p>

      {items.length === 0 && seeded && (
        <p className="text-sm text-ink-muted">{labels.empty}</p>
      )}

      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={item.kind === "own" ? item.key : item.id}>
            <Card className="flex-row items-start gap-1 p-3">
              <span className="w-6 shrink-0 pt-0.5 font-display text-sm font-bold text-on-paper-muted">
                {index + firstNumber}.
              </span>
              {renderItem(item, index)}
              <ItemControls
                index={index}
                n={index + firstNumber}
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
      {full && <p className="text-sm text-ink-muted">{labels.full}</p>}

      <ReadyMadeList
        id={moreId}
        available={available}
        full={full}
        labels={labels}
        dispatch={dispatch}
      />
    </div>
  );
}
