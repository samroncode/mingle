import { cn } from "@/lib/utils";

interface VoteButtonsProps {
  candidates: Array<{ userId: string; name: string }>;
  /** The user id the guest voted for, or null. */
  chosen: string | null;
  onChoose: (userId: string) => void;
}

/** One big button per guest to vote for; the picked one stays marked. */
export function VoteButtons({
  candidates,
  chosen,
  onChoose,
}: VoteButtonsProps) {
  return (
    <div className="grid gap-3">
      {candidates.map(({ userId, name }) => (
        <button
          key={userId}
          type="button"
          aria-pressed={chosen === userId}
          onClick={() => onChoose(userId)}
          className={cn(
            "flex min-h-16 items-center rounded-lg border px-4 py-3 text-left text-lg font-semibold",
            chosen === userId
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
