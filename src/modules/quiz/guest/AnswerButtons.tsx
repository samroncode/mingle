import { cn } from "@/lib/utils";
import { optionLetters } from "../screen";

interface AnswerButtonsProps {
  options: string[];
  /** The option the guest chose, or null. */
  chosen: number | null;
  onChoose: (index: number) => void;
}

/** Four big buttons for an open question; the chosen one stays marked. */
export function AnswerButtons({
  options,
  chosen,
  onChoose,
}: AnswerButtonsProps) {
  return (
    <div className="grid gap-3">
      {options.map((option, index) => (
        <button
          key={index}
          type="button"
          aria-pressed={chosen === index}
          onClick={() => onChoose(index)}
          className={cn(
            "flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left text-lg",
            chosen === index
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background",
          )}
        >
          <span className="font-bold">{optionLetters[index]}</span>
          <span>{option}</span>
        </button>
      ))}
    </div>
  );
}
