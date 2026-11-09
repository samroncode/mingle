import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PickTileProps {
  children: ReactNode;
  picked: boolean;
  onPress: () => void;
  /** Fills the tile with a bright colour (the outcome buttons). */
  fill?: "sage" | "blush";
}

/** A big, plain tap target for one choice among several: paper until picked, champagne once picked. */
export function PickTile({ children, picked, onPress, fill }: PickTileProps) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPress}
      className={cn(
        "fun-lift flex min-h-16 w-full items-center justify-center rounded-md border-[length:var(--border-chunky)] border-edge px-4 py-3 text-center font-display text-xl font-bold shadow-pop-sm transition-[transform,box-shadow] duration-(--duration-fast)",
        picked
          ? "translate-x-[3px] translate-y-[3px] bg-champagne text-on-bright shadow-none"
          : fill === "sage"
            ? "bg-sage text-on-bright"
            : fill === "blush"
              ? "bg-blush text-on-bright"
              : "bg-paper text-on-paper",
      )}
    >
      {children}
    </button>
  );
}
