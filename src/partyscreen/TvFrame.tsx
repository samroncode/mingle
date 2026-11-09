import type { ReactNode } from "react";

/**
 * The mat round the TV picture, like a framed poster or a Frame TV showing art.
 * It fills the screen (the host's mirror sets --tv-bleed and --tv-min-h to fit its own box); the content sits on the surface inside it.
 */
export function TvFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="tv-frame"
      className="m-[calc(var(--tv-bleed,var(--space-6))*-1)] flex min-h-[var(--tv-min-h,100svh)] bg-frame p-(--space-7)"
    >
      <div className="flex flex-1 flex-col gap-(--space-5) bg-surface px-(--space-7) py-(--space-6) outline outline-1 outline-edge">
        {children}
      </div>
    </div>
  );
}
