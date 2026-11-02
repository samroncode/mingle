import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface SheetFrameProps {
  /** The id of the heading inside, for the dialog's name. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

/** The guest's small bottom sheet: a dialog over a dimmed page, closed by Escape or a tap outside. */
export function SheetFrame({ labelledBy, onClose, children }: SheetFrameProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-surface-sunken/70 p-4 sm:items-center"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid="bill-sheet"
        className="max-h-[85svh] w-full max-w-md space-y-4 overflow-y-auto rounded-lg border-[length:var(--border-thin)] border-edge bg-paper p-5 text-on-paper"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
