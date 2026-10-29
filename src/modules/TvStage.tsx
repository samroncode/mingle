import type { ComponentProps } from "react";
import { FunZone } from "@/components/FunZone";
import { cn } from "@/lib/utils";
import { Confetti } from "./Confetti";
import { usePartyMoment } from "./usePartyMoment";

interface TvStageProps extends ComponentProps<"section"> {
  /** True on a reveal or winner screen, which gets a few seconds of party. */
  moment: boolean;
  /** Names the moment, so the next one gets its own few seconds. */
  momentKey: string;
}

/**
 * The forest panel every activity shows on the TV. Playful by default, with
 * confetti and the party level for a few seconds when `moment` turns on.
 */
export function TvStage({
  moment,
  momentKey,
  className,
  children,
  ...props
}: TvStageProps) {
  const level = usePartyMoment(moment, momentKey);
  return (
    <FunZone level={level}>
      <section
        className={cn(
          "relative flex min-h-[70svh] flex-col justify-center gap-8 overflow-hidden rounded-xl border-[length:var(--border-chunky)] border-edge bg-forest p-(--space-7) text-on-forest shadow-pop-lg",
          className,
        )}
        {...props}
      >
        {level === "party" && <Confetti />}
        {children}
      </section>
    </FunZone>
  );
}

/** The small "Question 3 of 10" label above a TV screen's headline. */
export function TvCounter({ children }: { children: string }) {
  return (
    <p className="font-display text-3xl font-bold tracking-wide text-champagne-text uppercase">
      {children}
    </p>
  );
}
