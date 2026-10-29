import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface AnswerButtonsProps {
  /** True for Agree, false for Disagree, null before an answer. */
  chosen: boolean | null;
  onChoose: (agree: boolean) => void;
}

/** Two big buttons, Agree (sage) and Disagree (blush); the picked one is pressed in and checked. */
export function AnswerButtons({ chosen, onChoose }: AnswerButtonsProps) {
  const { t } = useTranslation();
  const options = [
    {
      agree: true,
      label: t("modules.hottakes.guest.agree"),
      fill: "bg-sage",
      Icon: ThumbsUp,
    },
    {
      agree: false,
      label: t("modules.hottakes.guest.disagree"),
      fill: "bg-blush",
      Icon: ThumbsDown,
    },
  ];
  return (
    <div className="grid gap-4">
      {options.map(({ agree, label, fill, Icon }) => {
        const picked = chosen === agree;
        return (
          <button
            key={String(agree)}
            type="button"
            aria-pressed={picked}
            onClick={() => onChoose(agree)}
            className={cn(
              "fun-lift flex min-h-20 items-center justify-center gap-3 rounded-md border-[length:var(--border-chunky)] border-edge px-4 py-3 font-display text-2xl font-extrabold text-on-bright shadow-pop-sm transition-[transform,box-shadow] duration-(--duration-fast)",
              fill,
              picked
                ? "translate-x-[3px] translate-y-[3px] shadow-none"
                : chosen !== null && "opacity-75",
            )}
          >
            <Icon aria-hidden className="size-7" strokeWidth={2.5} />
            {label}
            {picked && <Check aria-hidden strokeWidth={3} className="size-7" />}
          </button>
        );
      })}
    </div>
  );
}
