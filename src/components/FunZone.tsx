import type { ComponentProps } from "react";
import { cn } from "cn";
import type { FunLevel } from "@/lib/fun";

interface FunZoneProps extends ComponentProps<"div"> {
  level: FunLevel;
}

/**
 * Sets the fun dial for everything inside it. The nearest zone wins, because the dial is
 * a set of CSS custom properties keyed on `data-fun` and inherited down the tree.
 */
export function FunZone({ level, className, ...props }: FunZoneProps) {
  return (
    <div
      data-slot="fun-zone"
      data-fun={level}
      className={cn("contents", className)}
      {...props}
    />
  );
}
