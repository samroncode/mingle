/** The dashboard's sections, in the order of the left navigation. */
export const navSections = [
  "live",
  "activities",
  "program",
  "messages",
  "guests",
  "costs",
  "party",
] as const;

export type NavSection = (typeof navSections)[number];

/** The id of a section's element on the page. */
export const sectionElementId = (section: NavSection | "event") =>
  `dash-${section}`;

/** The small number beside a navigation item; a section without a count is left out. */
export function navCounts(counts: {
  activities: number;
  program: number;
  guests: number;
}): Partial<Record<NavSection, number>> {
  return {
    activities: counts.activities,
    program: counts.program,
    guests: counts.guests,
  };
}

/**
 * The section the host is looking at: the last one whose top has passed the
 * reading line. `tops` are the sections' distances from the top of the viewport.
 * Falls back to the topmost section.
 */
export function sectionInView<T extends string>(
  tops: readonly { id: T; top: number }[],
  line: number,
): T | undefined {
  if (tops.length === 0) return undefined;
  // The section nearest above the line, whatever order the list is in.
  let current = tops.reduce((first, entry) =>
    entry.top < first.top ? entry : first,
  ).id;
  let best = -Infinity;
  for (const entry of tops) {
    if (entry.top <= line && entry.top > best) {
      best = entry.top;
      current = entry.id;
    }
  }
  return current;
}

/** "19:30" as minutes after midnight, or undefined when it isn't a time. */
function minutesOf(time: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 24 * 60 ? minutes : undefined;
}

/**
 * Which program line is on now: the last timed line that has started. Nothing
 * (-1) when no line has a time, or none has started yet.
 */
export function currentProgramIndex(
  lines: readonly { time?: string }[],
  nowMinutes: number,
): number {
  let current = -1;
  lines.forEach((line, index) => {
    const start = minutesOf(line.time);
    if (start !== undefined && start <= nowMinutes) current = index;
  });
  return current;
}
