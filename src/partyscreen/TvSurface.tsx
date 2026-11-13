import type { ReactNode } from "react";

/**
 * The TV picture, edge to edge on the surface with a small margin round the content.
 * It fills the screen (the host's mirror sets --tv-bleed and --tv-min-h to fit its own box).
 */
export function TvSurface({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="tv-surface"
      className="m-[calc(var(--tv-bleed,var(--space-6))*-1)] flex min-h-[var(--tv-min-h,100svh)] flex-col gap-(--space-5) bg-surface px-(--space-7) py-(--space-6)"
    >
      {children}
    </div>
  );
}
