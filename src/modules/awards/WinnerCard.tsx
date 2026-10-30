import type { ReactNode } from "react";
import { Trophy } from "lucide-react";
import { FunZone } from "@/components/FunZone";

/** The phone's winner moment: a champagne card that pops in, with a trophy. */
export function WinnerCard({
  testId,
  children,
}: {
  testId: string;
  children: ReactNode;
}) {
  return (
    <FunZone level="party">
      <p
        data-testid={testId}
        className="fun-pop fun-tilt flex items-center gap-3 rounded-lg border-[length:var(--border-thin)] border-edge bg-champagne px-4 py-4 font-display text-3xl leading-tight font-extrabold text-on-bright"
      >
        <Trophy aria-hidden className="size-9 shrink-0" strokeWidth={2.5} />
        <span>{children}</span>
      </p>
    </FunZone>
  );
}
