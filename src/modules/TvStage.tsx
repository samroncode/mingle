import type { ComponentProps } from "react";
import { FunZone } from "@/components/FunZone";
import { cn } from "@/lib/utils";
import { AwardDots } from "./AwardDots";
import { Confetti } from "./Confetti";
import { usePartyMoment } from "./usePartyMoment";

interface TvStageProps extends ComponentProps<"section"> {
  /** True on a reveal or winner screen, which gets a few seconds of party. */
  moment: boolean;
  /** Names the moment, so the next one gets its own few seconds. */
  momentKey: string;
  /**
   * `award` turns the stage into a diploma (wine red, soft light dots and no
   * confetti) for an award winner; `stage` is every other activity screen.
   */
  tone?: "stage" | "award";
}

/**
 * The panel every activity shows on the TV. Playful by default, with confetti
 * and the party level for a few seconds when `moment` turns on.
 */
export function TvStage({
  moment,
  momentKey,
  tone = "stage",
  className,
  children,
  ...props
}: TvStageProps) {
  const level = usePartyMoment(moment, momentKey);
  const award = tone === "award";
  return (
    <FunZone level={level}>
      <section
        data-tone={tone}
        className={cn(
          "relative flex h-full flex-col justify-center gap-8 overflow-hidden rounded-xl border-[length:var(--border-thin)] border-edge p-(--space-7)",
          award
            ? "items-center bg-award text-center text-on-award"
            : "bg-stage text-on-stage",
          className,
        )}
        {...props}
      >
        {award && <AwardDots />}
        {!award && level === "party" && <Confetti />}
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
