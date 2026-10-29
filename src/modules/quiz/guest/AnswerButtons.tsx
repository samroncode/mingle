import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { optionFills } from "../../optionFills";
import { optionLetters } from "../screen";

interface AnswerButtonsProps {
  options: string[];
  /** The option the guest chose, or null. */
  chosen: number | null;
  onChoose: (index: number) => void;
}

/** Four big buttons for an open question; the chosen one stays pressed in with a check. */
export function AnswerButtons({
  options,
  chosen,
  onChoose,
}: AnswerButtonsProps) {
  return (
    <div className="grid gap-3">
      {options.map((option, index) => {
        const picked = chosen === index;
        return (
          <button
            key={index}
            type="button"
            aria-pressed={picked}
            onClick={() => onChoose(index)}
            className={cn(
              "fun-lift flex min-h-16 items-center gap-3 rounded-md border-[length:var(--border-chunky)] border-edge px-4 py-3 text-left font-display text-xl font-bold text-on-bright shadow-pop-sm transition-[transform,box-shadow] duration-(--duration-fast)",
              optionFills[index],
              picked
                ? "translate-x-[3px] translate-y-[3px] shadow-none"
                : chosen !== null && "opacity-75",
            )}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-paper font-extrabold text-on-paper">
              {optionLetters[index]}
            </span>
            <span className="flex-1">{option}</span>
            {picked && <Check aria-hidden strokeWidth={3} className="size-6" />}
          </button>
        );
      })}
    </div>
  );
}
