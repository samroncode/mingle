import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Move up, move down and remove for one line of a list step. */
export function LineControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.lines.moveUp", { n: index + 1 })}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        <ArrowUp />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.lines.moveDown", { n: index + 1 })}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        <ArrowDown />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("wizard.lines.remove", { n: index + 1 })}
        onClick={() => onRemove(index)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
