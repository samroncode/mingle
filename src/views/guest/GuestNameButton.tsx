import { Pencil } from "lucide-react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface GuestNameButtonProps {
  name: string;
  /** Whether the rename form is open. */
  open: boolean;
  onToggle: () => void;
  /** The header slot; without one the button stays where it is rendered. */
  slot: HTMLElement | null | undefined;
}

/** The guest's name in the header, with a pencil that opens the rename form. */
export function GuestNameButton({
  name,
  open,
  onToggle,
  slot,
}: GuestNameButtonProps) {
  const { t } = useTranslation();
  const button = (
    <button
      type="button"
      aria-expanded={open}
      aria-label={t("guest.renameFor", { name })}
      onClick={onToggle}
      className="flex min-h-12 min-w-0 items-center gap-1.5 rounded-sm px-2 font-display text-base font-bold text-ink hover:text-coral-text"
    >
      <span className="truncate">{name}</span>
      <Pencil aria-hidden className="size-4 shrink-0 text-ink-muted" />
    </button>
  );
  return slot ? createPortal(button, slot) : button;
}
