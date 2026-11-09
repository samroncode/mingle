import type { ReactNode } from "react";
import { sectionElementId, type NavSection } from "@/lib/host/dashboard-nav";

/**
 * A flat dashboard section: a small-caps label, a thin line above, and the
 * content. The id is what the left navigation scrolls to.
 */
export function DashSection({
  section,
  title,
  children,
}: {
  section: NavSection | "event";
  /** Left out where the content brings its own heading. */
  title?: string;
  children: ReactNode;
}) {
  const id = sectionElementId(section);
  return (
    <section
      id={id}
      aria-labelledby={title ? `${id}-title` : undefined}
      className="scroll-mt-28 space-y-3"
    >
      {title && (
        <h2
          id={`${id}-title`}
          className="font-display text-sm font-bold uppercase tracking-wide text-ink-muted"
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
