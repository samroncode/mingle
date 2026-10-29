import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoteButtonsProps {
  candidates: Array<{ userId: string; name: string }>;
  /** The user id the guest voted for, or null. */
  chosen: string | null;
  onChoose: (userId: string) => void;
}

/** One big button per guest to vote for; the picked one is pressed in, filled and checked. */
export function VoteButtons({
  candidates,
  chosen,
  onChoose,
}: VoteButtonsProps) {
  return (
    <div className="grid gap-3">
      {candidates.map(({ userId, name }) => {
        const picked = chosen === userId;
        return (
          <button
            key={userId}
            type="button"
            aria-pressed={picked}
            onClick={() => onChoose(userId)}
            className={cn(
              "fun-lift flex min-h-16 items-center gap-3 rounded-md border-[length:var(--border-chunky)] border-edge px-4 py-3 text-left font-display text-xl font-bold shadow-pop-sm transition-[transform,box-shadow] duration-(--duration-fast)",
              picked
                ? "translate-x-[3px] translate-y-[3px] bg-champagne text-on-bright shadow-none"
                : "bg-paper text-on-paper",
            )}
          >
            <span className="flex-1">{name}</span>
            {picked && <Check aria-hidden strokeWidth={3} className="size-6" />}
          </button>
        );
      })}
    </div>
  );
}
