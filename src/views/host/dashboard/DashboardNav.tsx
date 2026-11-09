import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EventRow, MemberRow } from "@/api/events";
import { countGuests } from "@/partyscreen/guests";
import {
  navCounts,
  navSections,
  sectionElementId,
  sectionInView,
  type NavSection,
} from "@/lib/host/dashboard-nav";
import { readParty } from "@/lib/party";
import { cn } from "cn";

/** Where the reading line is, below the sticky top bar. */
const readingLine = 140;

type Target = NavSection | "event";

function scrollTo(target: Target) {
  const element = document.getElementById(sectionElementId(target));
  if (!element) return;
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({
    behavior: calm ? "auto" : "smooth",
    block: "start",
  });
}

/** The section in view, tracked on scroll. */
function useSectionInView(targets: readonly Target[]): Target | undefined {
  const [current, setCurrent] = useState<Target | undefined>(targets[0]);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const tops = targets.flatMap((id) => {
        const element = document.getElementById(sectionElementId(id));
        return element
          ? [{ id, top: element.getBoundingClientRect().top }]
          : [];
      });
      setCurrent(sectionInView(tops, readingLine));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [targets]);
  return current;
}

function NavButton({
  target,
  label,
  count,
  current,
}: {
  target: Target;
  label: string;
  count?: number;
  current: boolean;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "location" : undefined}
      onClick={() => scrollTo(target)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left font-display font-bold",
        current
          ? "bg-surface-sunken text-ink"
          : "text-ink-muted hover:text-ink",
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className="text-sm font-normal text-ink-muted">{count}</span>
      )}
    </button>
  );
}

const allTargets: readonly Target[] = [...navSections, "event"];

/**
 * The dashboard's left navigation: jumps to a section of the work area and
 * marks the one in view. Bright room and End the evening sit at the bottom.
 */
export function DashboardNav({
  event,
  members,
}: {
  event: EventRow;
  members: MemberRow[];
}) {
  const { t } = useTranslation();
  const current = useSectionInView(allTargets);
  const counts = navCounts({
    activities: event.enabled_modules.length,
    program: readParty(event.party).schedule?.length ?? 0,
    guests: countGuests(members),
  });
  const ended = event.status === "ended";
  return (
    <div className="sticky top-28 flex min-h-[calc(100svh-11rem)] flex-col">
      <ul className="space-y-0.5">
        {navSections.map((section) => (
          <li key={section}>
            <NavButton
              target={section}
              label={t(`hostPanel.dashboard.nav.${section}`)}
              count={counts[section]}
              current={current === section}
            />
          </li>
        ))}
      </ul>
      <ul className="mt-auto space-y-0.5 border-t-[length:var(--border-thin)] border-line pt-3">
        {!ended && (
          <li>
            <NavButton
              target="event"
              label={t("hostPanel.dashboard.nav.brightRoom")}
              current={false}
            />
          </li>
        )}
        <li>
          <NavButton
            target="event"
            label={t("hostPanel.dashboard.nav.end")}
            current={current === "event"}
          />
        </li>
      </ul>
    </div>
  );
}
