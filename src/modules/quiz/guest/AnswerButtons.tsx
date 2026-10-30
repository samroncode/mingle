import { ChoiceTile } from "../../ChoiceTile";
import { choiceState } from "../../choiceState";
import { optionTones } from "../../optionFills";
import { optionLetters } from "../screen";

interface AnswerButtonsProps {
  options: string[];
  /** The option the guest chose, or null. */
  chosen: number | null;
  onChoose: (index: number) => void;
}

/** Four big tiles for an open question, each with its letter. */
export function AnswerButtons({
  options,
  chosen,
  onChoose,
}: AnswerButtonsProps) {
  return (
    <div className="grid gap-3">
      {options.map((option, index) => (
        <ChoiceTile
          key={index}
          fill={optionTones[index] ?? "paper"}
          label={option}
          leading={
            <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-paper font-extrabold text-on-paper">
              {optionLetters[index]}
            </span>
          }
          state={choiceState(chosen === index, chosen !== null)}
          onPress={() => onChoose(index)}
        />
      ))}
    </div>
  );
}
