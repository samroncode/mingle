import type { ReactNode } from "react";
import { cn } from "cn";

interface ChoiceButtonProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/** A large tappable option for a pick-one step. */
export function ChoiceButton({
  selected,
  onSelect,
  children,
}: ChoiceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl p-4 text-left ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-card text-card-foreground",
      )}
    >
      {children}
    </button>
  );
}
