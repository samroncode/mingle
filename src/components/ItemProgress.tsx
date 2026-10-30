import { cn } from "@/lib/utils";

interface ItemProgressProps {
  /** The activity, such as "Quiz". */
  activity: string;
  /** Where the guest is, such as "Question 1 of 2". */
  position: string;
  number: number;
  total: number;
}

/** Whether segment `index` (0-based) is behind, at or ahead of item `number` (1-based). */
function segmentState(
  index: number,
  number: number,
): "done" | "current" | "upcoming" {
  if (index + 1 < number) return "done";
  return index + 1 === number ? "current" : "upcoming";
}

const segmentLook = {
  done: "bg-ink-muted",
  current: "bg-champagne-text",
  upcoming: "bg-line",
} as const;

/**
 * Where the evening is in one activity: a small uppercase label and a bar
 * with one segment per item. Shared by quiz, awards and hot takes on the phone.
 * Not pressable, so it has no outline or shadow.
 */
export function ItemProgress({
  activity,
  position,
  number,
  total,
}: ItemProgressProps) {
  const label = `${activity} · ${position}`;
  return (
    <div className="space-y-2">
      <p
        aria-hidden
        className="text-sm font-bold tracking-wider text-champagne-text uppercase"
      >
        {label}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={number}
        className="flex gap-1.5"
      >
        {Array.from({ length: total }, (_, index) => {
          const state = segmentState(index, number);
          return (
            <span
              key={index}
              data-segment={state}
              className={cn("h-1.5 flex-1 rounded-full", segmentLook[state])}
            />
          );
        })}
      </div>
    </div>
  );
}
