import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { GuestChoice } from "@/lib/wheel/participants";

/** The joined guests with a checkbox each, and the select all / none shortcuts. */
export function GuestChoices({
  choices,
  disabled,
  canAddNew,
  onToggle,
  onAll,
  onNone,
}: {
  choices: GuestChoice[];
  disabled: boolean;
  /** False when the wheel is full: guests without an entry can't be ticked. */
  canAddNew: boolean;
  onToggle: (choice: GuestChoice) => void;
  onAll: () => void;
  onNone: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display font-bold">
          {t("modules.wheel.host.guestsTitle")}
        </h3>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || choices.length === 0}
          onClick={onAll}
        >
          {t("modules.wheel.host.selectAll")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || choices.length === 0}
          onClick={onNone}
        >
          {t("modules.wheel.host.selectNone")}
        </Button>
      </div>
      {choices.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t("modules.wheel.host.guestsEmpty")}
        </p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {choices.map((choice) => (
            <li key={choice.userId}>
              <label className="flex min-h-12 items-center gap-3 rounded-md px-2 hover:bg-surface-sunken">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={choice.onWheel}
                  disabled={disabled || (!choice.entryId && !canAddNew)}
                  aria-label={t("modules.wheel.host.guestCheck", {
                    name: choice.name,
                  })}
                  onChange={() => onToggle(choice)}
                />
                <span className="min-w-0 break-words">{choice.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-muted">
        {t("modules.wheel.host.guestNote")}
      </p>
    </div>
  );
}
