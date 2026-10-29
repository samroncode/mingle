import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

interface ChoiceButtonProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}

/**
 * A large tappable option for a pick-one step. The selected one is filled and
 * carries a check mark, so it never relies on color alone.
 */
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
        "flex min-h-16 w-full items-center gap-3 rounded-md border-[length:var(--border-chunky)] border-edge p-4 text-left font-body transition-[transform,box-shadow,background-color] duration-(--duration-fast) outline-none active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        selected
          ? "translate-x-[3px] translate-y-[3px] bg-champagne text-on-bright"
          : "bg-paper text-on-paper shadow-pop-sm",
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-pill border-[length:var(--border-chunky)] border-edge",
          selected ? "bg-sage text-on-bright" : "bg-surface-sunken",
        )}
      >
        {selected && <Check className="size-5" />}
      </span>
    </button>
  );
}
