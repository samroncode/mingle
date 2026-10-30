import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChoiceTile } from "../../ChoiceTile";
import { choiceState, type ChoiceFill } from "../../choiceState";

interface AnswerButtonsProps {
  /** True for Agree, false for Disagree, null before an answer. */
  chosen: boolean | null;
  onChoose: (agree: boolean) => void;
}

/** Two big tiles, Agree (sage) and Disagree (blush). */
export function AnswerButtons({ chosen, onChoose }: AnswerButtonsProps) {
  const { t } = useTranslation();
  const options: Array<{
    agree: boolean;
    label: string;
    fill: ChoiceFill;
    Icon: typeof ThumbsUp;
  }> = [
    {
      agree: true,
      label: t("modules.hottakes.guest.agree"),
      fill: "sage",
      Icon: ThumbsUp,
    },
    {
      agree: false,
      label: t("modules.hottakes.guest.disagree"),
      fill: "blush",
      Icon: ThumbsDown,
    },
  ];
  return (
    <div className="grid gap-4">
      {options.map(({ agree, label, fill, Icon }) => (
        <ChoiceTile
          key={String(agree)}
          size="lg"
          fill={fill}
          label={label}
          leading={<Icon aria-hidden className="size-7" strokeWidth={2.5} />}
          state={choiceState(chosen === agree, chosen !== null)}
          onPress={() => onChoose(agree)}
        />
      ))}
    </div>
  );
}
