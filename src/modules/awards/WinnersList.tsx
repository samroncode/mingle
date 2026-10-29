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

/** Every revealed category with its winner, in order. */
export function WinnersList({
  results,
  members,
  language,
  large = false,
}: WinnersListProps) {
  return (
    <ol
      data-testid="awards-winners"
      className={cn("space-y-3", large ? "text-3xl" : "text-base")}
    >
      {results.map((result) => (
        <li key={result.categoryId}>
          <p className="text-muted-foreground">{result.text}</p>
          <p className="font-semibold">
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
