import type { ReactNode } from "react";
import { cn } from "cn";

interface HostFrameProps {
  /** The work area of the current view. */
  main: ReactNode;
  /** Right column on wide screens (Run only); Prepare leaves it out. */
  side?: ReactNode;
}

/**
 * The layout of the control panel, with no data of its own. One column on a
 * phone; from `lg` the work area with an optional side column, separated by a
 * thin line.
 */
export function HostFrame({ main, side }: HostFrameProps) {
  return (
    <div
      data-testid="host-frame"
      className={cn(
        side &&
          "lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:divide-x-[length:var(--border-thin)] lg:divide-line",
      )}
    >
      <div data-testid="host-main" className="space-y-6 lg:px-6 lg:py-4">
        {main}
      </div>
      {side && (
        <aside
          data-testid="host-side"
          className="hidden lg:block lg:px-4 lg:py-4"
        >
          {side}
        </aside>
      )}
    </div>
  );
}
