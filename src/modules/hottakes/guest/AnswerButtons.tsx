import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface AnswerButtonsProps {
  /** True for Agree, false for Disagree, null before an answer. */
  chosen: boolean | null;
  onChoose: (agree: boolean) => void;
}

/** Two big buttons, Agree and Disagree; the picked one stays marked. */
export function AnswerButtons({ chosen, onChoose }: AnswerButtonsProps) {
  const { t } = useTranslation();
  const options = [
    { agree: true, label: t("modules.hottakes.guest.agree") },
    { agree: false, label: t("modules.hottakes.guest.disagree") },
  ];
  return (
    <div className="grid gap-3">
      {options.map(({ agree, label }) => (
        <button
          key={String(agree)}
          type="button"
          aria-pressed={chosen === agree}
          onClick={() => onChoose(agree)}
          className={cn(
            "flex min-h-20 items-center justify-center rounded-lg border px-4 py-3 text-xl font-semibold",
            chosen === agree
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-background",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
