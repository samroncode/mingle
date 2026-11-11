interface ProgramLine {
  time?: string;
  title: string;
}

/** "19:30" as minutes after midnight, or undefined when it isn't a time. */
function minutesOf(time: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 24 * 60 ? minutes : undefined;
}

/**
 * The next program point: the earliest timed line that has not started yet.
 * Undefined when no line has a time, or every timed line has started.
 */
export function nextProgramPoint<T extends ProgramLine>(
  lines: readonly T[],
  nowMinutes: number,
): T | undefined {
  let best: { line: T; start: number } | undefined;
  for (const line of lines) {
    const start = minutesOf(line.time);
    if (start === undefined || start <= nowMinutes) continue;
    if (!best || start < best.start) best = { line, start };
  }
  return best?.line;
}
