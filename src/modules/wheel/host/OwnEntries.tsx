import { X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { WheelEntryView } from "@/api/wheel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WheelLabelSchema, wheelLimits } from "@/lib/schemas/wheel";

/** The host's own entries on the wheel, the field to add one, and suggestions. */
export function OwnEntries({
  entries,
  suggestions,
  disabled,
  full,
  onAdd,
  onTakeOff,
}: {
  entries: WheelEntryView[];
  suggestions: Array<{ id: string; text: string }>;
  disabled: boolean;
  full: boolean;
  /** Resolves true when the entry was saved. */
  onAdd: (label: string) => Promise<boolean>;
  onTakeOff: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const parsed = WheelLabelSchema.safeParse(draft);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (parsed.success && (await onAdd(parsed.data))) setDraft("");
  }

  return (
    <div className="space-y-2">
      <h3 className="font-display font-bold">
        {t("modules.wheel.host.ownTitle")}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {t("modules.wheel.host.ownEmpty")}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-1 rounded-md border border-edge bg-paper pl-3 text-on-paper"
            >
              <span className="break-words">{entry.label}</span>
              <Button
                size="icon"
                variant="secondary"
                disabled={disabled}
                aria-label={t("modules.wheel.host.takeOff", {
                  name: entry.label,
                })}
                onClick={() => onTakeOff(entry.id)}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-sm text-ink-muted">
          {t("modules.wheel.host.full", { max: wheelLimits.perEvent })}
        </p>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => void submit(e)}
        >
          <Input
            className="min-w-0 flex-1"
            value={draft}
            maxLength={wheelLimits.label}
            aria-label={t("modules.wheel.host.ownLabel")}
            placeholder={t("modules.wheel.host.ownPlaceholder")}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className="text-xs text-ink-muted">
            {t("modules.wheel.host.ownCounter", {
              count: draft.length,
              max: wheelLimits.label,
            })}
          </span>
          <Button type="submit" disabled={disabled || !parsed.success}>
            {t("modules.wheel.host.ownAdd")}
          </Button>
        </form>
      )}
      {!full && suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-ink-muted">
            {t("modules.wheel.host.suggestionsTitle")}
          </p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.id}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  aria-label={t("modules.wheel.host.suggestionAdd", {
                    name: s.text,
                  })}
                  onClick={() => void onAdd(s.text)}
                >
                  {s.text}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
