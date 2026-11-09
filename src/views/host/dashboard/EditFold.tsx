import type { ReactNode } from "react";

/**
 * The place an editor folds out in on the dashboard: the one paper surface,
 * since the existing editors are made for paper.
 */
export function EditFold({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="space-y-3 rounded-lg border-[length:var(--border-thin)] border-edge bg-paper p-4 text-on-paper"
    >
      {children}
    </section>
  );
}
