import type { AwardResult } from "@/api/awards";
import type { MemberRow } from "@/api/events";
import { cn } from "@/lib/utils";
import { WinnerText } from "./WinnerText";

interface WinnersListProps {
  results: AwardResult[];
  members: MemberRow[];
  language: string;
  /** Larger text for the TV. */
  large?: boolean;
}

/** Every revealed category with its winner, in order, one paper card each. */
export function WinnersList({
  results,
  members,
  language,
  large = false,
}: WinnersListProps) {
  return (
    <ol
      data-testid="awards-winners"
      className={cn("grid gap-3", large ? "grid-cols-2 gap-5" : "text-base")}
    >
      {results.map((result, index) => (
        <li
          key={result.categoryId}
          className={cn(
            "fun-tilt rounded-md border-[length:var(--border-chunky)] border-edge bg-paper px-4 py-3 text-on-paper shadow-pop-sm",
            index % 2 === 0 ? "-rotate-2" : "rotate-2",
            large && "px-6 py-5",
          )}
        >
          <p
            className={cn(
              "text-on-paper-muted",
              large ? "text-2xl" : "text-sm",
            )}
          >
            {result.text}
          </p>
          <p
            className={cn(
              "font-display font-extrabold",
              large ? "text-4xl" : "text-lg",
            )}
          >
            <WinnerText
              winners={result.winners}
              members={members}
              language={language}
            />
          </p>
        </li>
      ))}
    </ol>
  );
}
