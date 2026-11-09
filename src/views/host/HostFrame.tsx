import type { ReactNode } from "react";

interface HostFrameProps {
  /** Accessible name of the navigation landmark. */
  navLabel?: string;
  /** Left column on wide screens. Filled by the "Dashboard middle" ticket (section navigation). */
  nav?: ReactNode;
  /** The work area. Today it holds every section in the old order; later tickets move them out. */
  main: ReactNode;
  /** Right column on wide screens. Filled by the "Dashboard right column" ticket (TV mirror, guests, message). */
  side?: ReactNode;
  /** Phone-only area above the sections. Filled by the "Phone" ticket (running activity first). */
  phoneTop?: ReactNode;
}

/**
 * The layout of the control panel, with no data of its own. One column on a
 * phone; from `lg` a flat three-column frame separated by thin lines.
 */
export function HostFrame({
  nav,
  navLabel,
  main,
  side,
  phoneTop,
}: HostFrameProps) {
  return (
    <div
      data-testid="host-frame"
      className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)_22rem] lg:divide-x-[length:var(--border-thin)] lg:divide-line"
    >
      <nav
        data-testid="host-nav"
        className="hidden lg:block lg:px-4 lg:py-4"
        aria-label={nav ? navLabel : undefined}
        aria-hidden={nav ? undefined : true}
      >
        {nav}
      </nav>
      <div data-testid="host-main" className="space-y-6 lg:px-6 lg:py-4">
        {phoneTop && <div className="lg:hidden">{phoneTop}</div>}
        {main}
      </div>
      <aside
        data-testid="host-side"
        className="hidden lg:block lg:px-4 lg:py-4"
        aria-hidden={side ? undefined : true}
      >
        {side}
      </aside>
    </div>
  );
}
