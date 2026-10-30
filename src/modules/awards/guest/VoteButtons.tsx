import { ChoiceTile } from "../../ChoiceTile";
import { choiceState } from "../../choiceState";

interface VoteButtonsProps {
  candidates: Array<{ userId: string; name: string }>;
  /** The user id the guest voted for, or null. */
  chosen: string | null;
  onChoose: (userId: string) => void;
}

/** One big tile per guest to vote for. */
export function VoteButtons({
  candidates,
  chosen,
  onChoose,
}: VoteButtonsProps) {
  return (
    <div className="grid gap-3">
      {candidates.map(({ userId, name }) => (
        <ChoiceTile
          key={userId}
          fill="paper"
          label={name}
          state={choiceState(chosen === userId, chosen !== null)}
          onPress={() => onChoose(userId)}
        />
      ))}
    </div>
  );
}
