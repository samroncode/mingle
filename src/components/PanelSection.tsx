import { ChevronDown } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { cn } from "cn";

/**
 * Sections inside this provider are flat rows (thin lines, no card). Only the
 * phone layout of the host panel uses it.
 */
const FlatContext = createContext(false);
export const FlatSections = FlatContext.Provider;

/**
 * Sections inside this provider have no header and no fold: something else
 * (Prepare's section list) is the navigation, so the editor is always open.
 */
const BareContext = createContext(false);
export const BareSections = BareContext.Provider;

interface PanelSectionProps {
  title: string;
  /** One calm line shown under the title, also while the section is shut. */
  summary?: string;
  /** Small label next to the title, such as a "Running" sticker. */
  badge?: ReactNode;
  testId?: string;
  defaultOpen?: boolean;
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
  children,
}: PanelSectionProps) {
  const bodyId = useId();
  const flat = useContext(FlatContext);
  const bare = useContext(BareContext);
  const [open, setOpen] = useState(defaultOpen);

  if (bare) {
    return (
      <section data-testid={testId} data-open className="space-y-3">
        {summary && <p className="text-sm text-ink-muted">{summary}</p>}
        {children}
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      data-open={open}
      className={cn(
        flat
          ? "border-b-[length:var(--border-thin)] border-line"
          : "rounded-lg border-[length:var(--border-thin)] border-edge bg-paper text-on-paper",
      )}
    >
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex min-h-14 w-full items-center justify-between gap-3 text-left",
            flat ? "py-3" : "rounded-lg p-4",
          )}
        >
          <span className="min-w-0 space-y-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "font-display font-bold",
                  flat ? "text-lg" : "text-xl",
                )}
              >
                {title}
              </span>
              {badge}
            </span>
            {summary && (
              <span
                className={cn(
                  "block text-sm",
                  flat ? "text-ink-muted" : "text-on-paper-muted",
                )}
              >
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
        <div
          id={bodyId}
          className={cn("space-y-3", flat ? "pb-4" : "px-4 pb-4")}
        >
          {children}
        </div>
      )}
    </section>
  );
}
