import type { ReactNode } from "react";
import { Check, X, type LucideIcon } from "lucide-react";
import { FunZone } from "@/components/FunZone";
import { cn } from "@/lib/utils";

interface ResultBadgeProps {
  /** Good news goes green with a check, anything else danger with a cross. */
  good: boolean;
  testId?: string;
  children: ReactNode;
}

/**
 * The phone's reveal: a word and an icon that pop in, so the result is never
 * color alone. A short party moment, then it sits still.
 */
export function ResultBadge({ good, testId, children }: ResultBadgeProps) {
  const Icon: LucideIcon = good ? Check : X;
  return (
    <FunZone level="party">
      <p
        data-testid={testId}
        className={cn(
          "fun-pop flex items-center gap-3 rounded-lg border-[length:var(--border-chunky)] border-edge px-4 py-3 font-display text-3xl font-extrabold text-on-bright shadow-pop-md",
          good ? "bg-sage" : "bg-danger",
        )}
      >
        <Icon aria-hidden className="size-8 shrink-0" strokeWidth={3} />
        <span>{children}</span>
      </p>
    </FunZone>
  );
}
