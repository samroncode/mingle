import { useTranslation } from "react-i18next";
import type { WheelEntryView } from "@/api/wheel";
import { Button } from "@/components/ui/button";

/** Entries taken off the wheel, each with a one-tap Put back. */
export function TakenOff({
  entries,
  nameOf,
  disabled,
  onPutBack,
  onRemove,
}: {
  entries: WheelEntryView[];
  nameOf: (entry: WheelEntryView) => string;
  disabled: boolean;
  onPutBack: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (entries.length === 0) return null;
  return (
    <div data-testid="wheel-taken-off" className="space-y-2">
      <h3 className="font-display font-bold">
        {t("modules.wheel.host.offTitle")}
      </h3>
      <ul className="space-y-1">
        {entries.map((entry) => {
          const name = nameOf(entry);
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words">{name}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                aria-label={t("modules.wheel.host.putBack", { name })}
                onClick={() => onPutBack(entry.id)}
              >
                {t("modules.wheel.host.putBackShort")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled}
                aria-label={t("modules.wheel.host.removeOff", { name })}
                onClick={() => onRemove(entry.id)}
              >
                {t("modules.wheel.host.removeShort")}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
