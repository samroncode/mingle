import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "cn";

interface PanelSectionProps {
  title: string;
  /** One calm line shown under the title, also while the section is shut. */
  summary?: string;
  /** Small label next to the title, such as a "Running" sticker. */
  badge?: ReactNode;
  testId?: string;
  defaultOpen?: boolean;
  /** Opens the section whenever this turns true; the host can still shut it. */
  openWhen?: boolean;
  children: ReactNode;
}

/**
 * A control panel section that is shut by default. Its content is only
 * rendered while it is open, so long lists cost nothing until they are asked
 * for. The header is the button.
 */
export function PanelSection({
  title,
  summary,
  badge,
  testId,
  defaultOpen = false,
  openWhen = false,
  children,
}: PanelSectionProps) {
  const bodyId = useId();
  const [open, setOpen] = useState(defaultOpen || openWhen);

  // Open when `openWhen` turns true (adjusting state while rendering).
  const [wasOpenWhen, setWasOpenWhen] = useState(openWhen);
  if (openWhen !== wasOpenWhen) {
    setWasOpenWhen(openWhen);
    if (openWhen) setOpen(true);
  }

  return (
    <section
      data-testid={testId}
      data-open={open}
      className="rounded-lg border-[length:var(--border-thin)] border-edge bg-paper text-on-paper"
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg p-4 text-left"
        >
          <span className="min-w-0 space-y-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-bold">{title}</span>
              {badge}
            </span>
            {summary && (
              <span className="block text-sm text-on-paper-muted">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn("size-6 shrink-0", open && "rotate-180")}
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="space-y-3 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
